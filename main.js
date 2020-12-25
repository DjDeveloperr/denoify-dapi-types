const fs = require("fs");
const path = require("path");

if (!fs.existsSync("repo")) throw new Error("'repo' dir is not present");

function readAllContents(dir) {
    let files = fs.readdirSync(dir);
    let res = [];

    for (let file of files) {
        let fp = path.join(dir, file);
        let stat = fs.lstatSync(fp);

        if (stat.isDirectory()) {
            res = [...res,...readAllContents(fp)];
        } else res.push(fp);
    }

    return res;
}

const REGEX = new RegExp(/[import|export](?:["'\s]*([\w*{}\n\r\t, ]+)from\s*)?["'\s].*([@\w_-]+)["'\s].*;$/, 'gm');

function denoifyImports(dir) {
    if (!fs.existsSync("deno")) fs.mkdirSync("deno");

    let files = readAllContents(dir);
    let done = 0;

    for (let file of files) {
        let cont = fs.readFileSync(file, 'utf-8').toString();
        let m = cont.match(REGEX);

        if (m === null) m = [];
        let pathmod = path;

        cont.replace(REGEX, m => {
            if (!m.startsWith("import") && !m.startsWith("export")) return;

            let path = m.split("from").pop().trim();

            while(path.endsWith(";")) path = path.substr(0, path.length - 1);
            while(path.endsWith("'")) path = path.substr(0, path.length - 1);
            while(path.startsWith("'")) path = path.substr(1, path.length - 1);

            let newpath = path;
            if (newpath == "./") newpath = "./index.ts";
            let fp = file.replace(/\\/g, "/").split('/');
            fp.pop();
            fp = fp.join("/");

            let ep = pathmod.join(fp, newpath);

            if (!fs.existsSync(ep)) ep += '.ts';
            if (!fs.existsSync(ep)) ep = ep.substr(0, ep.length - 3) + '/index.ts';
            if (!fs.existsSync(ep)) return m + "/index.ts";

            let stat = fs.lstatSync(ep);
            if (stat.isDirectory()) {
                newpath += '/index.ts';
            } else newpath += '.ts';

            cont = cont.replace(m, m.replace(path, newpath));
            return m.replace(path, newpath);
        });

        cont = cont.replace(/from '.\/'/g, "from './index.ts'");
        cont = cont.replace(/from '..\/v8'/g, "from '../v8/index.ts'");

        let np = file;
        if (np.startsWith("repo")) np = 'deno' + np.slice(4);

        let spl = np.replace(/\\/g, "/").split("/");
        spl.forEach((e,i) => {
            if (e.endsWith(".ts")) return;
            let cp = spl.filter((_,ii)=>ii<=i).join("/");
            if (!fs.existsSync(cp)) fs.mkdirSync(cp);
        });

        fs.writeFileSync(np, cont);
        done++;
    }

    return done;
}

["./repo/v8","./repo/v6","./repo/common","./repo/default"].forEach(e=>denoifyImports(e));