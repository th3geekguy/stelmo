const fileList = ["ucp-nodes.txt", "dsinfo.txt", "ucp-proxy.txt", "dtr-registry-"];

class Node {
    hostname;
    id;
    role;
    osVersion;
    hypervisor;
    avail;
    state;
    ip;
    engver;
    mkemsr;
    collect;
    orch;
    createdUpdated;
    os;
    statusMsg;

    constructor(node) { // json of node - "ucp-nodes.txt"
        const na = 'N/A';

        // Description
        var desc = node.Description;
        this.hostname = ('Hostname' in desc) ? desc.Hostname : na;
        var arch = ('Architecture' in desc.Platform) ? desc.Platform.Architecture : na;
        this.os = ('OS' in desc.Platform) ? desc.Platform.OS : na;
        let os_details = fullOSDetails(this.hostname) ? (this.os == 'linux') : [na, '-'];
        var os_string = os_details[0];
        this.hypervisor = os_details[1];
        this.engver = ('EngineVersion' in desc.Engine) ? desc.Engine.EngineVersion : na;

        // Status
        var status = node.Status;
        this.state = status.State
        var addr = ('Addr' in status) ? status.Addr : na;
        this.statusMsg = ('Message' in status) ? status.Message : na;
        this.statusMsg = this.statusMsg.replace('UCP', 'MKE').trim();

        // Spec
        var spec = node.Spec;
        this.role = spec.Role;
        this.avail = spec.Availability;
        this.collect = spec["Labels"]["com.docker.ucp.access.label"];
        var o_swarm = '-';
        var o_kube = '-';
        if ('com.docker.ucp.orchestrator.swarm' in spec.Labels && 
            spec.Labels['com.docker.ucp.orchestrator.swarm'] == 'true')
        {
            o_swarm = 'swarm';
        }
        if ('com.docker.ucp.orchestrator.kubernetes' in spec.Labels && 
            spec.Labels['com.docker.ucp.orchestrator.kubernetes'] == 'true')
        {
            o_swarm = 'kube';
        }
        this.orch = [o_swarm, o_kube].join('/');

        // Manager Status
        var m_stat = ('ManagerStatus' in node) ? node['ManagerStatus'] : "";
        addr = (addr == '127.0.0.1' || addr == '0.0.0.0') ? m_stat['Addr'] : addr;
        this.ip = addr.replace(':2377', '').trim();
        this.role = (this.role == 'manager' && ('Leader' in m_stat) && m_stat['Leader'] == true) ? 'leader' : this.role;

        // Other
        this.id = node['ID'].slice(0, 10);
        var created = node.CreatedAt.split('T')[0];
        var updated = node.UpdatedAt.split('T')[0];
        this.createdUpdated = [created, updated].join('/');
    }

    getOSDetails(text) {
        var osType = '-';
        var osVersion = '---';
        var dsiOS = "No Info " // docker system info result
        var fullOSText = osType + '-' + osVersion + '/' + dsiOS
        var hpv = 'None'

        text.split("\n").forEach(line => {
            line = line.trim();

            if (line.startsWith("Operating System:"))
            {
                dsiOS = line.split(': ')[1].trim();
                dsiOS = dsiOS.replace('Red Hat Enterprise Linux', 'RHEL');
                dsiOS = dsiOS.split('(')[0]; // RHEL 7.9 (Maipo) ==> RHEL 7.9
            }
            if (line.startsWith("NAME="))
            {
                osType = trimmer(line.split('=')[1].trim(), '"');
                if (osType.startsWith("Red"))
                {
                    osType = "RHEL"
                }
            }
            if (line.startsWith("VERSION="))
            {
                osVersion = trimmer(line.split('=')[1].trim(), '"');
                osVersion = osVersion.split('(')[0].trim();
            }

            fullOSText = osType + '-' + osVersion + '/' + dsiOS;

            if (line.startsWith("Hypervisor vendor:"))
            {
                hpv = line.split(': ')[1].trim();
            }
        });
        fullOSText = (osType + '-' + osVersion + '/' + dsiOS).trim();
        this.osVersion = fullOSText.trim();
        this.hypervisor = hpv;
    }

    getMKEVersions(json) {
        const keyword = "IMAGE_VERSION"
        var env = json[0]['Config']['Env'];
        env.forEach(key => {
            if (key.includes(keyword))
            {
                return key.split('=')[1];
            }
        })
    }

    getMSRVersions(json) {
        const keyword = "DTR_VERSION"
        var env = json[0]['Config']['Env'];
        env.forEach(key => {
            if (key.includes(keyword))
            {
                return key.split('=')[1];
            }
        })
    }

    getVersions_Old(json) {
        var ucpver = '';
        if ('com.docker.ucp.node-state-augmented.reconciler-ucp-version' in json.Labels)
        {
            ucpver = json.Labels['com.docker.ucp.node-state-augmented.reconciler-ucp-version']
        }
        if ('com.docker.ucp.node-state-augmented')
        {

        }
        //var ucpver = getddcver(hostname, 'ucp-proxy.txt', 'IMAGE_VERSION');
        //var dtrver = getddcver(hostname, 'dtr-registry-*.txt', 'DTR_VERSION');
        var dtrver = '';

        if (dtrver != '-')
        {
            role += '/MSR';
        }
        this.mkemsr = [ucpver, dtrver].join('/');
    }
}

function trimmer(str, ch) {
    var start = 0, 
        end = str.length;

    while(start < end && str[start] === ch)
        ++start;

    while(end > start && str[end - 1] === ch)
        --end;

    return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}

function createSDTable(nodes) {
    var headers = ['Hostname', 'ID', 'Role', 'OS Version', 'HPVS', 'Avail', 'State', 'IP', 'MCR', 'MKE/MSR', 'Collect', 'Orch', 'Created/Updated', 'OS', 'Status']

    var table = document.createElement('table');
    var headerBody = document.createElement('thead');
    var headerRow = document.createElement('tr');

    headers.forEach(headerText => {
        let header = document.createElement('th');
        let textNode = document.createTextNode(headerText);
        header.appendChild(textNode);
        headerRow.appendChild(header);
    })

    headerBody.appendChild(headerRow);
    table.appendChild(headerBody);

    var tableBody = document.createElement('tbody');

    nodes.forEach(node => {
        let row = document.createElement('tr');

        Object.values(node).forEach(text => {
            let cell = document.createElement('td');
            let textNode = document.createTextNode(text || "--");
            cell.appendChild(textNode);
            row.appendChild(cell);
        })

        tableBody.appendChild(row);
    });

    table.appendChild(tableBody);
    table.classList.add("styled-table");

    document.querySelector('#sd_table_div').appendChild(table);
}

function fullOSDetails(hostname) {
    return ['OS', 'hypervisor'];
}

function createNodeObjects(text) {
    const sd = JSON.parse(text);

    var nodes = []

    for (let obj in sd) {
        let node = sd[obj];

        let n = new Node(node);
        nodes.push(n);
    }

    return nodes;
}

var $result = $("#result");
var $table = $("#sd_table_div");
var $ripple = $("#ripple");
$ripple.hide();
function processFile(file) {

    $result.html("");
    $table.html("");
    // be sure to show the results
    $("#result_block").removeClass("hidden").addClass("show");
    
    var nodes = [];

    // Closure to capture the file information.
    function handleFile(f) {
        var $title = $("<h4>", {
            text: f.name
        });
        var $fileContent = $("<ul>");
        $result.append($title);
        $result.append($fileContent);

        var dateBefore = new Date();
                    
        JSZip.loadAsync(f) // 1) read the Blob
            .then(function(zip) {
                    var dateAfter = new Date();
                    $title.append($("<span>", {
                        "class": "small",
                        text: " (loaded in " + (dateAfter - dateBefore) + "ms)"
                    }));

                    $ripple.show();

                    var entries = Object.keys(zip.files).map(function (name) {
                        return zip.files[name];
                    })

                    var listPromises = entries.map(function(entry) {
                        if (fileList.some(f => entry.name.includes(f)))
                        {
                            return entry.async("text").then(function(txt) {
                                return [entry.name, txt];
                            });
                        }
                    });

                    var promiseList = Promise.all(listPromises);

                    promiseList.then(function(list) {
                        var files = list.filter(function(elem) {
                            return elem !== undefined;
                        });

                        files.forEach(fileColl => {
                            if (fileColl[0].includes(fileList[0]))
                            {
                                nodes = createNodeObjects(fileColl[1]);
                            }
                        })

                        var dsinfo = files.filter(function(file) {
                            if (file[0].includes(fileList[1]))
                            {
                                return file;
                            }
                        });

                        var versionsMKE = files.filter(function(file) {
                            if (file[0].includes(fileList[2]) && file[0].endsWith(".txt"))
                            {
                                return file;
                            }
                        })

                        var versionsMSR = files.filter(function(file) {
                            if (file[0].includes(fileList[3]) && file[0].endsWith(".txt"))
                            {
                                return file;
                            }
                        })

                        nodes.forEach(node => {
                            dsinfo.forEach(dsi => {
                                if (dsi[0].includes(node.hostname))
                                {
                                    node.getOSDetails(dsi[1]);
                                }
                            })
                            versionsMKE.forEach(vrs => {
                                if (vrs[0].includes(node.hostname))
                                {
                                    node.getMKEVersions(JSON.parse(vrs[1]));
                                }
                            })
                            versionsMSR.forEach(vrs => {
                                if (vrs[0].includes(node.hostname))
                                {
                                    node.getMKEVersions(JSON.parse(vrs[1]));
                                }
                            })
                        })

                        nodes = nodes.sort(function(a, b) {
                            return a.hostname > b.hostname ? 1 : -1;
                            });

                        createSDTable(nodes);
                        $ripple.hide();
                    })

                },
                function(e) {
                    $result.append($("<div>", {
                        "class": "alert alert-danger",
                        text: "Error reading " + f.name + ": " + e.message
                    }));
                });
            }
    handleFile(file);
}


//selecting all required elements
const dropArea = document.querySelector(".drag-area"),
  dragText = dropArea.querySelector("header"),
  button = dropArea.querySelector("button"),
  input = dropArea.querySelector("#file");
let file; //this is a global variable and we'll use it inside multiple functions
button.onclick = () => {
  input.click(); //if user click on the button then the input also clicked
};

input.addEventListener("change", function () {
  //getting user select file and [0] this means if user select multiple files then we'll select only the first one
  file = this.files[0];
  dropArea.classList.add("active");
  showFile(); //calling function
});

//If user Drag File Over DropArea
dropArea.addEventListener("dragover", (event) => {
  event.preventDefault(); //preventing from default behaviour
  dropArea.classList.add("active");
  dragText.textContent = "Release to Upload File";
});
//If user leave dragged File from DropArea
dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("active");
  dragText.textContent = "Drag & Drop to Upload File";
});
//If user drop File on DropArea
dropArea.addEventListener("drop", (event) => {
  event.preventDefault(); //preventing from default behaviour
  //getting user select file and [0] this means if user select multiple files then we'll select only the first one
  file = event.dataTransfer.files[0];
  showFile(); //calling function
});
function showFile() {
  let fileType = file.type; //getting selected file type
  let fileReader = new FileReader(); //creating new FileReader object
    fileReader.onload = () => {
      let fileURL = fileReader.result; //passing user file source in fileURL variable
      // UNCOMMENT THIS BELOW LINE. I GOT AN ERROR WHILE UPLOADING THIS POST SO I COMMENTED IT
      // let imgTag = `<img src="${fileURL}" alt="image">`; //creating an img tag and passing user selected file source inside src attribute
      //dropArea.innerHTML = imgTag; //adding that created img tag inside dropArea container
    };
    processFile(file);
}
