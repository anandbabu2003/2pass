
let inputFileContent = '';
let optabFileContent = '';
let i = 0, j = 0;
const opcode_list = [];
const opcode_hex = {};
const sym_list = [];
const sym_addresses = [];
let locctr = 0;
let startingAddress = '';
let endAddress = 0; 

document.getElementById('Input_file').addEventListener('change', (event) => {
    const input_file = event.target.files[0];

    if (input_file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            inputFileContent = e.target.result;
            checkFilesAndEnableButton();
        };
        reader.readAsText(input_file);
    }
});

document.getElementById('Optab_file').addEventListener('change', (event) => {
    const optab_file = event.target.files[0];

    if (optab_file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            optabFileContent = e.target.result;
            processOptabContents(optabFileContent);
            checkFilesAndEnableButton();
        };
        reader.readAsText(optab_file);
    }
});

function checkFilesAndEnableButton() {
    const startButton = document.querySelector('button#startButton');
    if (inputFileContent && optabFileContent) {
        startButton.disabled = false;
    }
}

function processFileContent(content) {
    const lines = content.split('\n');
    const output = document.getElementById('output_input');
    const intermediate = document.getElementById('inter_file');
    const symtab = document.getElementById('symtab');
    symtab.innerHTML = `Label\tlocctr\tflag\n\n\n`;

    lines.forEach(line => {
        const words = line.trim().split('\t');
        if (words.length <= 3) {
            let [label, opcode, operand] = words.map(word => word.trim());
            output.innerHTML += `${label || '[EMPTY]'}\t${opcode || '[EMPTY]'}\t${operand || '[EMPTY]'}\n`;
            if (label !== '**' && opcode !=='START') {
                if (!sym_list.includes(label)) {
                    sym_list[j++] = label;
                    sym_addresses.push(locctr);
                    symtab.innerHTML += `${label}\t${locctr.toString(16).toUpperCase()}\t 0 \n`;
                }
            }
            if (opcode === 'START') {
                locctr = parseInt(operand, 16);
                startingAddress = locctr.toString(16).padStart(6, '0').toUpperCase();
                intermediate.innerHTML += `\t${label || '[EMPTY]'}\t${opcode || '[EMPTY]'}\t${operand || '[EMPTY]'}\n`;
            } else {
                intermediate.innerHTML += `${locctr.toString(16).toUpperCase()}\t${label || '[EMPTY]'}\t${opcode || '[EMPTY]'}\t${operand || '[EMPTY]'}\n`;
                let flag = false;

                opcode_list.forEach(item => {
                    if (item === opcode) {
                        flag = true;
                        locctr += 3;
                    }
                });

                if (!flag) {
                    if (opcode === 'WORD') {
                        locctr += 3;
                    } else if (opcode === 'RESW') {
                        locctr += (3 * parseInt(operand, 10));
                    } else if (opcode === 'RESB') {
                        locctr += parseInt(operand, 10);
                    } else if (opcode === 'BYTE') {
                        let len = operand.length;
                        if (operand[0] === 'C' || operand[0] === 'c') {
                            len -= 3;
                        } else {
                            len = (len - 3) / 2;
                        }
                        locctr += len;
                    }
                }
            }
        } else {
            output.innerHTML += `Skipped line: "${line}" (more than 3 words)\n`;
        }
    });

    pass2();
}

function processOptabContents(content) {
    const lines = content.split('\n');
    const output = document.getElementById('output_optab');

    lines.forEach(line => {
        const words = line.trim().split(/\s+/);
        if (words.length <= 2) {
            let [opcode, hexcode] = words.map(word => word.trim());
            output.innerHTML += `${opcode || '[EMPTY]'}\t${hexcode || '[EMPTY]'}\n`;
            opcode_list[i++] = opcode;
            opcode_hex[opcode] = hexcode;
        } else {
            output.innerHTML += `Skipped line: "${line}" (more than 2 words)\n`;
        }
    });
}

function pass2() {
    const output = document.getElementById('output_pass2');
    const intermediate = document.getElementById('inter_file');
    const lines = intermediate.innerText.split('\n');
    const objectCodeLines = [];
    const objectCodes = [];

    lines.forEach((line, index) => {
        const words = line.trim().split('\t');
        let [address, label, opcode, operand] = words;

        if (index === 0 || !address || opcode === 'START') {
            if (opcode !== 'END') {
                objectCodeLines.push('\t' + line.trim() + '\t');
                return;
            }
        }

        if (opcode === 'END') {
            endAddress = locctr; 
        }

        const opcodeHex = opcode_hex[opcode];
        let objectCode = '';

        if (opcodeHex) {
            let operandAddress = '0000';
            const symIndex = sym_list.findIndex(sym => sym === operand);

            if (symIndex !== -1) {
                operandAddress = sym_addresses[symIndex].toString(16).toUpperCase().padStart(4, '0');
            } else if (operand.match(/^[0-9A-F]+$/i)) {
                operandAddress = operand.padStart(4, '0').toUpperCase();
            }

            objectCode = `${opcodeHex}${operandAddress}`;
        }
        if (opcode === 'WORD') {
            objectCode = parseInt(operand, 10).toString(16).padStart(6, '0').toUpperCase();
        }

        objectCodeLines.push(`${line.trim()}\t${objectCode}`);
        if (objectCode) objectCodes.push(objectCode);
    });

    output.innerHTML = objectCodeLines.join('\n');
    generateRecords(objectCodes);
}

function generateRecords(objectCodes) {
    const programName = 'COPY'.padEnd(6, ' ').replace(/ /g, '_'); 
    const length = (endAddress - parseInt(startingAddress, 16)).toString(16).padStart(6, '0').toUpperCase();
    const headerRecord = `H^${programName}^${startingAddress}^${length}`;

    const textRecords = [];
    let currentTextRecord = `T^${startingAddress}`;
    let currentLength = 0;

    objectCodes.forEach((code) => {
        if (currentLength + code.length / 2 > 30) {
            textRecords.push(currentTextRecord + `^${currentLength.toString(16).padStart(2, '0')}`);
            currentTextRecord = `T^${(parseInt(currentTextRecord.slice(2, 8), 16) + currentLength / 2).toString(16).padStart(6, '0').toUpperCase()}`;
            currentLength = 0;
        }
        currentTextRecord += `^${code}`;
        currentLength += code.length / 2;
    });

    if (currentLength > 0) {
        textRecords.push(currentTextRecord + `^${currentLength.toString(16).padStart(2, '0')}`);
    }

    const endRecord = `E^${startingAddress}`;

    document.getElementById('header-record').innerText = headerRecord;
    document.getElementById('text-record').innerText = textRecords.join('\n');
    document.getElementById('end-record').innerText = endRecord;

}
document.querySelector('button#startButton').addEventListener('click', () => {
    processFileContent(inputFileContent);
});
