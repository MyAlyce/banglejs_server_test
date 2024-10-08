
//By Joshua Brewster (MIT License)
export class CSV { //data=["1|2","11|22"], or data=[[1,2,"xyz"],[2,3,"abc"],etc]
    constructor(onOpen=this.onOpen, saveButtonId=null, openButtonId=null) {

        this.onOpen = onOpen;
        this.notes = []; //order comments by data index {idx:0,text:"comment"}

        if(saveButtonId !== null) {
            document.getElementById(saveButtonId).addEventListener('click', this.saveCSV);
        }
        if(openButtonId !== null) {
            document.getElementById(openButtonId).addEventListener('click', this.openCSV);
        }
    }

    processArraysForCSV(data=["1|2|3","3|2|1"],  delimiter="|", header="a,b,c",saveNotes=false) {
        let csvDat = header+"\n";
        let noteIdx = 0;
        data.forEach((line, i) => { //Add comments from an array with this structure this.notes = [{idx:n, text: "comment"},{...}]       
            if(data[i] === "string" && delimiter !== ",") { csvDat += line.split(delimiter).join(","); } 
            else{ csvData += line.join(",");} // Data can just be an array of arrays
            if (saveNotes === true) {
                if(this.notes[noteIdx].idx === i) {
                    line += this.notes[noteIdx].text;
                    noteIdx++;
                }
            }
            if(line.indexOf('\n') < 0) {csvDat+="\n";} //Add line endings exist in unprocessed array data
        });

        return csvDat;
    }

    //Converts an array of strings (e.g. raw data stream text) or an array of arrays representing lines of data into CSVs
    static saveCSV(csvDat="a,b,c\n1,2,3\n3,2,1\n", name=""){
        var hiddenElement = document.createElement('a');
        hiddenElement.href = "data:text/csv;charset=utf-8," + encodeURI(csvDat);
        hiddenElement.target = "_blank";
        if (name !== "") {
            if(!name.endsWith('.csv')) name += '.csv';
            hiddenElement.download = name;
        } else{
            hiddenElement.download = new Date().toISOString() + '.csv';
        }
        
        hiddenElement.click();
    }

    static openCSV(delimiter = ",", onOpen = (csvDat, header, path)=>{return csvDat, header, path;}) {
        return new Promise((res,rej) => {
            var input = document.createElement('input');
            input.accept = '.csv';
            input.type = 'file';
    
            input.onchange = (e) => {
                var file = e.target.files[0];
                var reader = new FileReader();
                reader.onload = (event) => {
                    var tempcsvData = event.target.result;
                    var tempcsvArr = tempcsvData.split("\n");
                    let header = [];
                    var csvDat = [];
                    tempcsvArr.pop();
                    tempcsvArr.forEach((row,i) => {
                        if(i==0){ header = row.split(delimiter); }
                        else{
                            var temp = row.split(delimiter);
                            csvDat.push(temp);
                        }
                    });
                    onOpen(csvDat,header,input.value);
                    input.value = '';
                    res({
                        data:csvDat, 
                        header:header, 
                        filename:input.value
                    });
                }
                reader.readAsText(file);
            }
            input.click();
        });
        
    } 

    //Dump CSV data without parsing it.
    static openCSVRaw(onOpen = (csvDat, path)=>{return csvDat, path;}) {
        return new Promise((res,rej) => {
            var input = document.createElement('input');
            input.accept = '.csv';
            input.type = 'file';
    
            input.onchange = (e) => {
                var file = e.target.files[0];
                var reader = new FileReader();
                reader.onload = (event) => {
                    var tempcsvData = event.target.result;
                    onOpen(tempcsvData, input.value);
                    input.value = '';
                    res({
                        data:tempcsvData,
                        filename: input.value
                    })
                }
                reader.readAsText(file);
            }
            input.click();
        })
    }

    onOpen(csvDat=[],header=[]) { // Customize this function in your init script, access data with ex. console.log(serialMonitor.csvDat), where var serialMonitor = new chromeSerial(defaultUI=false)
        console.log("CSV Opened!",header, csvDat);
    }
}



//e.g. let csv = CSV.openCSVRaw((data,head,path) => {
//   let name = path.split('/').pop();
//   result = parseCSVData(data,name,head);
//   console.log(result);
//})
export const parseCSVData = (
    data,
    filename,
    head, //will get from data if undefined
    hasend=true,
    parser=(
        lines,
        filename,
        head
    ) => { //generic parser for CSV files, spits out an object with arrays for each header

        let result = {
            filename:filename
        };

        let header = head; if(typeof head === 'string') header = head.split(',');
        result.header = header;
        
        for(let i = 0; i < lines.length; i++){
        
            let line = lines[i].split(',');
        
            for(let j = 0; j < line.length; j++){
        
                if(!result[header[j]]) result[header[j]] = [];
                
                result[header[j]].push(line[j]);
            }

        }
    
        return result; 
    
    }
) => {
    let lines;
    if(data.includes('\r'))
        lines = data.split('\r\n');
    else lines = data.split('\n');

    if(!head) head = lines[0];
    lines.shift(); 

    if(hasend === false) lines.pop(); //pop last row if they are likely incomplete
    let result = parser(lines, filename, head);
    return result;
}

export function toISOLocal(d) {
    d = new Date(d);
    var z  = n =>  ('0' + n).slice(-2);
    var zz = n => ('00' + n).slice(-3);
    var off = d.getTimezoneOffset();
    var sign = off < 0? '+' : '-';
    off = Math.abs(off);
  
    return d.getFullYear() + '-' //https://stackoverflow.com/questions/49330139/date-toisostring-but-local-time-instead-of-utc
           + z(d.getMonth()+1) + '-' +
           z(d.getDate()) + 'T' +
           z(d.getHours()) + ':'  + 
           z(d.getMinutes()) + ':' +
           z(d.getSeconds()) + '.' +
           zz(d.getMilliseconds()) + 
           "(UTC" + sign + z(off/60|0) + ':00)'
}

//pass an object with settings and data to process into CSV format
/**
 * option format:
 * {
 *  filename: 'filename',
 *  save: true, //will write a local CSV
 *  write:true, //will write to indexedDB, appending a file if it already exists
 *  dir: '/data', //directory if you want to save with browserfs
 *  header: ['timestamp','UTC','FP1','etc'],
 *  data: [{ //order of data is order of columns 
 *      x: [], //e.g. utc times. Used to create rows of data with the first column set to this
 *      timestamp: [], //e.g. ISO timestamps
 *      FP1; [1,2,3,4,5] //e.g.  filtered or raw data
 *    },
 *    {
 *      x: [], //e.g. utc times. Will splice rows with different timings into the same CSV
 *      timestamp: [], //UTC or ISO times
 *      FP1_FFT: [[0,1,2,3],[...],...], //e.g. periodic FFT data with different timing. Arrays of arrays get multiple columns
 *      FP2:[etc],...   
 *    }]
 *  }
 * }
 * 
 * result: [
 *  'timestamp,UTC,FP1,FP1_FFT,...,\n',
 *  '2012-12-12T12:12:12.000Z,123456,12345,123,...,\n',
 * ]
 * 
 */
//spits out an array of CSV rows in string format with endlines added
export const processDataForCSV = (options={}) => {
    if(!options.data) return undefined;
    if(!Array.isArray(options.data)) options.data = [options.data];
    if(options.data && !options.header) options.header = Object.keys(options.data[0]);
    let head = [...options.header];
    if(head.indexOf('timestamp') > -1) {
        head.splice(head.indexOf('timestamp') + 1, 0, 'localized');
    } 
    
    let header = head.join(',');

    let headeridx = 0;
    let lines = []; 
    let foreach = (obj, i) => {
        if(Array.isArray(obj)) { //unstructured data just gets pushed into a column
            for(let j = 0; j < obj.length; j++) {
                if(!lines[j]) lines[j] = '';
                if(Array.isArray(obj[j])) {
                    lines[j] += obj[j].join(',') + ',';
                    headeridx+=obj[j].length;
                }
                else {
                    lines[j] += obj[j] + ',';
                    headeridx++;
                }
            }
        } else if (typeof obj === 'object'){
            let x;
            if(obj.x) {
               x = obj.x; 
            } else if (obj.timestamp) {
                x = obj.timestamp;
            }
            let keys = options.header;
            for(let j = 0; j < x.length; j++) {
                if(!lines[j]) lines[j] = x[j] + ',';
                if(obj.timestamp) {
                    keys.splice(keys.indexOf('timestamp'), 1);
                    lines[j] += toISOLocal(obj.timestamp[j]) + ','; //add local timezone data
                } else if (obj.x) {
                    keys.splice(keys.indexOf('x'));
                }
                let lastIndex = keys.length - 1;
                for(let k = 0; k < keys.length; k++) {
                    const key = keys[k];
                    if(Array.isArray(obj[key][j])) {
                        lines[j] += obj[key][j].join(',') + (k === lastIndex ? '' : ','); 
                    }
                    else {
                        lines[j] += obj[key][j] + (k === lastIndex ? '' : ',');
                    }
                }
            }  
        }
    }

    options.data.forEach(foreach);

    header += '\n';

    let joined = lines.join('\n');

    let result = {filename:options.filename,header:header,body:joined};

    if(options.save) {
        CSV.saveCSV(header+joined,options.filename);
    }

    if(options.write) {
        fs.exists(options.filename, (exists) => {
            if(exists) 
                appendFile(options.filename, joined, options.dir);
            else
                appendFile(options.filename, header+joined, options.dir);
        });
    }

    return result;
}