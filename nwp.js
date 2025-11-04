#!/usr/bin/nodejs
process.stdin.setEncoding("utf8");
var fs = require('fs');
var path = require('path');
var os = require('os');
var readline = require('readline');
var args = process.argv.slice(2);
const dirname = path.dirname(path.resolve(args[0]));
var content = fs.readFileSync(path.join(dirname, args[0]), 'utf8');
var data = JSON.parse(content);
var vars = {};

var actionList = [];
var da = data.procedure.actions;
da.forEach(a => {
	if (fs.existsSync(path.join(dirname, a+".action"))) {
		actionList.push(a);
	} else {
		console.log("Action file "+a+" does not exist.");
	}
});
var importList = data.procedure.imports;
var imports = {};
importList.forEach((mod) => {
	var file = mod+".nwpackage";
	var modInfo = JSON.parse(fs.readFileSync(path.join(dirname, file), 'utf8'));
	var init = modInfo.package.init;
	itFun(init, actionList);
	imports[mod] = modInfo.package;
});



var mainFunct = data.procedure.main;

itFun(mainFunct, actionList);

function on(action) {
	let events = {};
	let evtpath = path.resolve(path.join(dirname, action.eventPath));
	if (fs.existsSync(path.join(evtpath, "events.nwevt"))) {
		events = JSON.parse(fs.readFileSync(path.join(evtpath, "events.nwevt")));
	}
	if (Object.keys(events).includes(action.event) && Object.keys(events).length > 0) {
		switch(events[action.event].type) {
			case 'basic':
				itFun(action.run, actionList);
				break;
			default:
				console.log("The event "+action.event+" has an incorrect type: "+events[action.event].type);
				break;
		}
		delete events[action.event];
		fs.writeFileSync(path.join(evtpath, "events.nwevt"), JSON.stringify(events), "utf8");
	}
}
function send(action) {
	let events = {};
	let evtpath = path.resolve(path.join(dirname, action.eventPath));
	if (fs.existsSync(path.join(evtpath, "events.nwevt"))) {
                events = JSON.parse(fs.readFileSync(path.join(evtpath, "events.nwevt")));
    }
	if (action.info) {
		events[action.event] = action.info;
		events[action.event].type = action.type;
	} else {
		events[action.event] = {"type":action.type};
	}
	fs.writeFileSync(path.join(evtpath, "events.nwevt"), JSON.stringify(events), "utf8");
}
function varCheck(str) {
	if (typeof str === "string") {
		if (str.includes("$var$")) {
			vn = str.replace("$var$", "");
			val = vars[vn];
			return val;
		} else {
			return str
		}
	} else {
		return str
	}
}

function condit(list) {
	var con;
	switch(list[1]) {
		case '=':
			con = list[0] == list[2];
			break;
		case '>':
			con = list[0] >= list[2];
			break;
		case '<':
			con = list[0] <= list[2];
			break;
		case '!':
			con = list[0] != list[2];
			break;
	}
	return con;
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // just loop until time passes
  }
}

function itFun(mainFunction, ai) {
	mainFunction.forEach(function(action, index) {
		switch(action.action) {
			case 'log':
	            	console.log(varCheck(action.text));
	            	break;
			/*case 'input':
				console.log(action.prompt);
				await process.stdin.on('data', (ch) => {
					const input = ch.trim();
					vars[action.var] = input;
					process.stdin.pause();
				});
				break;*/
	        case 'writeFile':
	            	fs.writeFileSync(path.join(dirname, varCheck(action.file)), varCheck(action.text), 'utf8');
	            	break;
			case 'readFile':
				let txt = fs.readFileSync(path.join(dirname, varCheck(action.file)), "utf8");
				console.log(txt);
				if (action.var) {
					vars[action.var] = txt;
				}
				break;
			case 'var':
				vars[action.name] = varCheck(action.value);
				break;
			case 'exec':
				const mod = action.mod;
				const run = action.run;
				if (imports[mod] && imports[mod][run]) {
					itFun(imports[mod][run], imports[mod].actions);
				} else {
					console.log(`Undefined: ${mod}.${run}`);
				}
				break;
			case 'if':
				if (condit(action.condition)) {
					itFun(action.run, actionList);
				}
				break;
			case 'while':
				while (condit(action.condition)) {
					itFun(action.run, actionList);
				}
				break;
			case 'wait':
				sleep(Number(varCheck(action.time))*1000);
				break;
			case 'clear':
				console.clear();
				break;
			case 'on':
				on(action);
			case 'send':
				send(action);
	        default:
			actionList.forEach(a => {
				let code = fs.readFileSync(path.join(dirname, a+".action"), "utf8");
				eval(code);
				var ctx = { action: action, vars: vars, imports: imports, fs: fs, path: path, itFun: itFun, dirname: dirname };
				fn(ctx);
			});
			break;
	    }
	});
}
