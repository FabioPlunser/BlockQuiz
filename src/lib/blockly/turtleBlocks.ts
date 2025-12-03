import * as Blockly from 'blockly'; 
import { javascriptGenerator as jG } from 'blockly/javascript';


Blockly.Blocks['turtle_move'] = { 
	init: function() { 
		this.appendValueInput('DISTANCE').setCheck('Number').appendField('move'); 
		this.setPreviousStatement(true); 
		this.setNextStatement(true); 
		this.setColour(230); 
		this.setTooltip('Moves turtle forward'); 
		}, 
	};

jG.forBlock['turtle_move'] = function(block) {
const distance = jG.valueToCode(block, 'DISTANCE', jG.ORDER_ATOMIC) || '0';
return `turtle.move(${distance});\n`;
};

Blockly.Blocks['turtle_turn'] = {
	init: function() {
		this.appendValueInput('DEGREES').setCheck('Number').appendField('turn'); 
		this.setPreviousStatement(true); 
		this.setNextStatement(true); 
		this.setColour(230); 
		this.setTooltip('Turns turtle right'); 
	}, 
};

jG.forBlock['turtle_turn'] = function(block) { 
const degrees = jG.valueToCode(block, 'DEGREES', jG.ORDER_ATOMIC) || '0';
return `turtle.turn(${degrees});\n`;
};

Blockly.Blocks['turtle_penDown'] = { 
	init: function() { 
		this.appendDummyInput().appendField('pen down');
		this.setPreviousStatement(true); 
		this.setNextStatement(true); 
		this.setColour(160); 
		this.setTooltip('Start Drawing'); 
		}, 
};

jG.forBlock['turtle_penDown'] = function(block) { 
return `turtle.penDown();\n`;
};

Blockly.Blocks['turtle_penUp'] = { 
	init: function() { 
		this.appendDummyInput().appendField('pen up');
		this.setPreviousStatement(true); 
		this.setNextStatement(true); 
		this.setColour(160); 
		this.setTooltip('Stop Drawing'); 
		}, 
};

jG.forBlock['turtle_penUp'] = function(block) { 
return `turtle.penUp();\n`;
};

Blockly.Blocks['turtle_color'] = { 
	init: function() { 
		this.appendValueInput('COLOR').setCheck('String').appendField('color'); 
		this.setPreviousStatement(true); 
		this.setNextStatement(true); 
		this.setColour(160); 
		this.setTooltip('Sets pen color'); 
		}, 
};

jG.forBlock['turtle_color'] = function(block) { 
const color = jG.valueToCode(block, 'COLOR', jG.ORDER_ATOMIC) || '#000';
return `turtle.color(${color});\n`;
};

Blockly.Blocks['turtle_reset'] = { 
	init: function() { 
		this.appendDummyInput().appendField('reset turtle');
		this.setPreviousStatement(true); 
		this.setNextStatement(true); 
		this.setColour(160); 
		this.setTooltip('Resets turtle'); 
		}, 
};

jG.forBlock['turtle_reset'] = function(block) { 
return `turtle.reset();\n`;
};

export const TURTLE_BLOCKS = [
	'turtle_move',
	'turtle_turn',
	'turtle_penDown',
	'turtle_penUp',
	'turtle_color',
	'turtle_reset'
];
