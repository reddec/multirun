#!/usr/bin/env node
const {cpus} = require('os');
const {spawn} = require('child_process');
const colors = require('colors');
const templayed = require('templayed');
const lineReader = require('line-reader');
const program = require('commander');


program
    .version('0.0.1')
    .option('-c, --count [n]', 'Number of executables', parseInt, cpus().length * 2)
    .option('-t, --timeout [ms]', 'Graceful shutdown timeout', parseInt, 5000)
    .option('-f, --fail-fast', 'Shutdown every instances if at least one exited', false)
    .parse(process.argv);

function pad(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

let tasks = [];
let shutdownState = false;
let padding = program.count.toString().length;

function taskExited(task, i, code, signal) {
    tasks[i] = null;
    if (code === null) {
        console.log(`task #${pad(i, padding)} closed by signal ${signal}`.magenta)
    } else {
        let color = code !== 0 ? colors.yellow : colors.green;
        console.log(color(`task #${pad(i, padding)} exited with code ${code}`))
    }
    if (code !== 0 && program.failFast) {
        shutdown();
    }
}

function taskFail(task, i, e) {
    tasks[i] = null;
    console.log("task #", pad(i, padding), "failed:", e);
    if (program.failFast) {
        shutdown();
    }
}

function taskOutLine(task, i, line) {
    console.log(`[task-${pad(i, padding)}] [STDOUT]`.green, line)
}

function taskErrLine(task, i, line) {
    console.log(`[task-${pad(i, padding)}] [STDERR]`.red, line)
}

function taskGracefulTimeout(task, i) {
    console.log(`task ${pad(i, padding)} graceful timeout reached - terminating`.red);
    task.kill('SIGKILL');
}

function shutdown() {
    if (shutdownState) return;
    shutdownState = true;
    console.log("shutdown...");
    tasks.filter((task) => !!task).forEach((task, i) => {
        let gracefull = setTimeout(() => taskGracefulTimeout(task, i), program.timeout);
        task.once('exit', () => clearTimeout(gracefull));
        task.kill('SIGTERM');
    });
}

for (let i = 0; i < program.count; ++i) {
    console.log("spawn #", i + 1, "child process");
    let args = program.args.slice(1).map((arg) => templayed(arg)({index: i}));
    let task = spawn(program.args[0], args, {
        shell: false, // prevent ignoring signals
        detached: false,
    });
    task.once('error', (e) => taskFail(task, i, e));
    task.once('exit', (code, signal) => taskExited(task, i, code, signal));
    lineReader.eachLine(task.stdout, (line) => taskOutLine(task, i, line));
    lineReader.eachLine(task.stderr, (line) => taskErrLine(task, i, line));
    tasks.push(task);
}


process.once('SIGINT', shutdown);