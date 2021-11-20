exportData = {
    profileMapping: {
        'Profile 17a': '17a',
        'Profile 35b': '35b',
        'Profile 8b': '8b',
        'Profile12a': '12a',
        'Profile BrcmPriv1': '35b'
    },
    qlnNull: -160,
    hlogNull: -96,
    fritzQlnNull: -1505,
    fritzHlogNull: -963
};

document.addEventListener('DOMContentLoaded', () => {
    run();
});

function run() {
    document.getElementById("uploadform").onsubmit = function (e) {
        e.preventDefault();
        const data = new FormData(this);
        let file = data.get("log");
        if (file && file.size > 0) {
            let reader = new FileReader();
            reader.onload = function () {
                convert(this.result);
            }
            reader.readAsText(file);
        } else {
            convert(data.get("logText"));
        }
    }
    document.getElementById('log').onchange = changeFile;
    changeFile();
}

function convert(result) {
    exportData.profile = null;
    exportData.hlogArray = [];
    exportData.hlogArrayUL = [];
    exportData.qlnArray = [];
    exportData.usTones = [];
    exportData.dsTones = [];
    exportData.qln = false;
    exportData.hlog = false;
    exportData.vectoring = 0;

    let lines = uniformLineEndings(result).split('\n');
    lines.forEach((line) => {
        if (!exportData.profile && line.startsWith('VDSL2 Profile:')) {
            exportData.profile = exportData.profileMapping[line.split(': ')[1].trim()];
            exportData.qln = false;
            exportData.hlog = false;
        } else if (line.startsWith('Tone number')) {
            if (line.endsWith('Hlog')) {
                exportData.hlog = true;
                exportData.qln = false;
            } else if (line.endsWith('QLN')) {
                exportData.hlog = false;
                exportData.qln = true
            }
        } else if (exportData.vectoring == 0
            && line.startsWith('Total error samples statuses sent')) {
            exportData.vectoring = parseInt(line.split(': ')[1].trim());
            exportData.qln = false;
            exportData.hlog = false;
        } else if (exportData.vectoring == 0 && line.startsWith('Total error samples statuses discarded')) {
            exportData.vectoring = parseInt(line.split(': ')[1].trim());
        } else if (line.startsWith('US: ')) {
            exportData.usTones = line.split(': (')[1].split('(').map(parseBandplan);
            exportData.qln = false;
            exportData.hlog = false;
        } else if (line.startsWith('DS: ')) {
            exportData.dsTones = line.split(': (')[1].split('(').map(parseBandplan);
            exportData.qln = false;
            exportData.hlog = false;
        } else if (line.startsWith('  ')) {
            if (exportData.qln) {
                exportData.qlnArray.push(parseFloat(line.split(/\s+/)[2].trim()));
            } else if (exportData.hlog) {
                exportData.hlogArray.push(parseFloat(line.split(/\s+/)[2].trim()));
            }
        } else {
            exportData.qln = false;
            exportData.hlog = false;
        }
    });
    exportData.hlogArrayUL = nullHlog(exportData.dsTones, exportData.hlogArray);
    exportData.hlogArray = nullHlog(exportData.usTones, exportData.hlogArray);

    exportData.qlnArray = toFritzboxArray(exportData.qlnArray);
    exportData.hlogArray = toFritzboxArray(exportData.hlogArray);
    exportData.hlogArrayUL = toFritzboxArray(exportData.hlogArrayUL);

    const output = createFritzExport();
    download("FritzBoxExport_" + (new Date()).toISOString() + ".txt", output);
};

function nullHlog(nullTones, array) {
    const res = array.slice();
    nullTones.forEach(x => {
        for (let i = x[0]; i < x[1]; i++) {
            res[i] = exportData.hlogNull;
        }
    })
    return res;
}

function toFritzboxArray(array) {
    const step = array.length / 512.0;
    const max = step * 512;
    const res = [];
    /* Starting with 'step' to be more compatible with hlog generator */
    for (let i = step; i < max; i += step) {
        res.push(toFritzDb(array[Math.round(i)]));
    }
    /* So far we've added only 511 values, let's add the last one */
    res.push(toFritzDb(array[array.length - 1]));
    return res;
}

function toFritzDb(val) {
    if (Math.trunc(val) == exportData.hlogNull) {
        return exportData.fritzHlogNull;
    } else if (Math.trunc(val) == exportData.qlnNull) {
        return exportData.fritzQlnNull;
    }
    return Math.round(val * 10);
}

function uniformLineEndings(val) {
    return val.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function parseBandplan(val) {
    if (val) {
        const array = val.split(',');
        if (array.length > 1) {
            return [parseInt(array[0].trim()), parseInt(array[1].trim())];
        }
    }
    return [0, 0];
}

function createFritzExport() {
    var txt = "VDSL2 Profile: " + exportData.profile;
    txt += "\nHLOG DS Array: " + exportData.hlogArray.toString().replace(/\[\]/, "");
    txt += "\nHLOG US Array: " + exportData.hlogArrayUL.toString().replace(/\[\]/, "");
    txt += "\nQLN Array: " + exportData.qlnArray.toString().replace(/\[\]/, "");
    txt += "\nVDSL2 GVECT error sample packets send: " + exportData.vectoring;

    return txt;
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'Data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function changeFile() {
    document.getElementById("logText").disabled = !(document.getElementById("delbtn").disabled = document.getElementById("log").value == "");
}
