/**
 * Plain-language readout of a Blockly workspace.
 *
 * Walks the workspace XML and emits a localized list of friendly bullet
 * lines describing what the program does. Used by the learner-facing
 * CodeReadout panel to bridge from blocks to natural-language description
 * (Weintrop & Wilensky 2015).
 *
 * Implementation note: the parser is intentionally narrow. It understands the
 * Blockly XML subset we actually emit (`block`, `shadow`, `field`, `value`,
 * `statement`, `next`) and treats everything else as opaque content. All regex
 * operations construct fresh `RegExp` instances per call so that `lastIndex`
 * cannot leak between recursive invocations.
 */

export type ReadoutLocale = 'en' | 'de';

type ParsedBlock = {
	type: string;
	id?: string;
	fields: Map<string, string>;
	values: Map<string, ParsedBlock | undefined>;
	statements: Map<string, ParsedBlock | undefined>;
	next?: ParsedBlock;
};

function parseAttributes(raw: string): Map<string, string> {
	const out = new Map<string, string>();
	const re = /([\w:-]+)="([^"]*)"/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(raw))) {
		out.set(match[1], match[2]);
	}
	return out;
}

/**
 * Locate the index of the closing tag that matches an opener at `searchStart`.
 * Handles nested same-tag occurrences correctly. Returns the index of the
 * closing `<` character, or `xml.length` if no matching close exists.
 */
function findMatchingCloseIndex(xml: string, searchStart: number, tag: string): number {
	const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
	re.lastIndex = searchStart;
	let depth = 1;
	let match: RegExpExecArray | null;
	while ((match = re.exec(xml))) {
		const isClose = match[1] === '/';
		const isSelfClosing = match[2] === '/';
		if (isClose) {
			depth -= 1;
			if (depth === 0) return match.index;
		} else if (!isSelfClosing) {
			depth += 1;
		}
		// self-closing same-tag entries do not change depth
	}
	return xml.length;
}

/**
 * Parse exactly one <block>/<shadow> element starting at or after `position`.
 * Returns the parsed block and the position immediately after its end tag
 * (or after the self-closing slash). If no block is found, returns undefined.
 */
function parseFirstBlockFrom(
	xml: string,
	position: number
): { block: ParsedBlock; end: number } | undefined {
	const openRe = /<(block|shadow)\b([^>]*?)(\/?)>/g;
	openRe.lastIndex = position;
	const open = openRe.exec(xml);
	if (!open) return undefined;

	const tag = open[1];
	const attrsRaw = open[2];
	const isSelfClosing = open[3] === '/';
	const attrs = parseAttributes(attrsRaw);

	const block: ParsedBlock = {
		type: attrs.get('type') ?? '',
		id: attrs.get('id'),
		fields: new Map(),
		values: new Map(),
		statements: new Map(),
		next: undefined
	};

	const innerStart = open.index + open[0].length;
	if (isSelfClosing) {
		return { block, end: innerStart };
	}

	const closeIndex = findMatchingCloseIndex(xml, innerStart, tag);
	const inner = xml.slice(innerStart, closeIndex);
	collectChildren(inner, block);

	// Skip past `</tag>` if it exists in bounds.
	const closeTag = `</${tag}>`;
	const end = closeIndex < xml.length ? closeIndex + closeTag.length : xml.length;
	return { block, end };
}

function collectChildren(inner: string, block: ParsedBlock) {
	// Fields are leaf-only and cannot themselves contain other blocks.
	const fieldRe = /<field\b([^>]*)>([\s\S]*?)<\/field>/g;
	let fieldMatch: RegExpExecArray | null;
	while ((fieldMatch = fieldRe.exec(inner))) {
		const attrs = parseAttributes(fieldMatch[1]);
		const name = attrs.get('name');
		if (!name) continue;
		block.fields.set(name, fieldMatch[2].trim());
	}

	// Walk the inner string left-to-right and pick up containers in order.
	// Each container reads its first child block (if any) and then we skip past it.
	let cursor = 0;
	while (cursor < inner.length) {
		const containerRe = /<(value|statement|next)\b([^>]*?)(\/?)>/g;
		containerRe.lastIndex = cursor;
		const container = containerRe.exec(inner);
		if (!container) break;

		const containerTag = container[1] as 'value' | 'statement' | 'next';
		const containerSelfClosing = container[3] === '/';
		const attrs = parseAttributes(container[2]);
		const name = attrs.get('name');

		const containerInnerStart = container.index + container[0].length;
		if (containerSelfClosing) {
			cursor = containerInnerStart;
			continue;
		}

		const containerCloseIndex = findMatchingCloseIndex(inner, containerInnerStart, containerTag);
		const containerInner = inner.slice(containerInnerStart, containerCloseIndex);

		const childResult = parseFirstBlockFrom(containerInner, 0);
		const childBlock = childResult?.block;

		if (containerTag === 'next') {
			if (childBlock) block.next = childBlock;
		} else if (name) {
			if (containerTag === 'value') block.values.set(name, childBlock);
			else block.statements.set(name, childBlock);
		}

		cursor = containerCloseIndex + `</${containerTag}>`.length;
	}
}

/**
 * Parse the top-level workspace XML and return the list of root blocks.
 * Each root block carries its `next` chain.
 */
function parseWorkspace(xml: string): ParsedBlock[] {
	const trimmed = xml.trim();
	if (!trimmed) return [];

	const xmlOpenIndex = trimmed.search(/<xml\b/);
	if (xmlOpenIndex < 0) return [];
	const xmlCloseIndex = trimmed.lastIndexOf('</xml>');
	if (xmlCloseIndex < 0) return [];

	const xmlInner = trimmed.slice(trimmed.indexOf('>', xmlOpenIndex) + 1, xmlCloseIndex);
	const roots: ParsedBlock[] = [];
	let cursor = 0;

	while (cursor < xmlInner.length) {
		const result = parseFirstBlockFrom(xmlInner, cursor);
		if (!result) break;
		roots.push(result.block);
		// Forward progress guarantee: end is always strictly greater than cursor
		// because parseFirstBlockFrom found a match starting at or after cursor
		// and consumed at least its opening tag.
		if (result.end <= cursor) break;
		cursor = result.end;
	}

	return roots;
}

const T = {
	en: {
		empty: 'Your workspace is empty. Drag some blocks in to start building.',
		standalone: 'Standalone block (not yet connected):',
		moveCells: (n: string) => `Move forward ${n} cells`,
		turnDegrees: (n: string) => `Turn ${n} degrees`,
		stepForward: 'Move forward 1 cell',
		turnLeft: 'Turn left',
		turnRight: 'Turn right',
		collect: 'Collect an item here',
		penDown: 'Lower the pen (start drawing)',
		penUp: 'Raise the pen (stop drawing)',
		setColor: (c: string) => `Change the line color to ${c}`,
		repeat: (n: string) => `Repeat ${n} times:`,
		whileTrue: 'Repeat while the condition is true:',
		ifThen: 'If the condition is true, then:',
		ifThenElse: 'If the condition is true, then …; otherwise …',
		setVar: (name: string) => `Set the variable "${name}"`,
		changeVar: (name: string) => `Change the variable "${name}"`,
		print: 'Print a value to the output',
		prompt: 'Ask the user for a value',
		unknown: (type: string) => `(${type})`,
		indent: '  '
	},
	de: {
		empty: 'Dein Arbeitsbereich ist leer. Ziehe Blöcke hinein, um zu starten.',
		standalone: 'Einzelner Block (noch nicht verbunden):',
		moveCells: (n: string) => `Gehe ${n} Zellen vorwärts`,
		turnDegrees: (n: string) => `Drehe dich um ${n} Grad`,
		stepForward: 'Gehe 1 Zelle vorwärts',
		turnLeft: 'Drehe dich nach links',
		turnRight: 'Drehe dich nach rechts',
		collect: 'Sammle einen Gegenstand hier ein',
		penDown: 'Stift senken (zeichnen)',
		penUp: 'Stift heben (nicht zeichnen)',
		setColor: (c: string) => `Ändere die Linienfarbe zu ${c}`,
		repeat: (n: string) => `Wiederhole ${n} Mal:`,
		whileTrue: 'Wiederhole, solange die Bedingung wahr ist:',
		ifThen: 'Wenn die Bedingung wahr ist, dann:',
		ifThenElse: 'Wenn die Bedingung wahr ist, dann …; sonst …',
		setVar: (name: string) => `Setze die Variable „${name}"`,
		changeVar: (name: string) => `Ändere die Variable „${name}"`,
		print: 'Gib einen Wert aus',
		prompt: 'Frage den Benutzer nach einem Wert',
		unknown: (type: string) => `(${type})`,
		indent: '  '
	}
} as const;

function readNumberShadow(value: ParsedBlock | undefined, fallback: string): string {
	if (!value) return fallback;
	if (value.type === 'math_number') {
		return value.fields.get('NUM') ?? fallback;
	}
	return fallback;
}

function describeBlock(block: ParsedBlock, locale: ReadoutLocale, indent: number, out: string[]) {
	const t = T[locale];
	const prefix = t.indent.repeat(indent);
	const push = (line: string) => out.push(`${prefix}${line}`);

	switch (block.type) {
		case 'move': {
			const n = readNumberShadow(block.values.get('STEPS'), '?');
			push(t.moveCells(n));
			break;
		}
		case 'turn': {
			const n = readNumberShadow(block.values.get('DEGREES'), '?');
			push(t.turnDegrees(n));
			break;
		}
		case 'step':
			push(t.stepForward);
			break;
		case 'turn_left':
			push(t.turnLeft);
			break;
		case 'turn_right':
			push(t.turnRight);
			break;
		case 'collect':
			push(t.collect);
			break;
		case 'pen': {
			const state = block.fields.get('STATE');
			push(state === 'up' ? t.penUp : t.penDown);
			break;
		}
		case 'color': {
			const c = block.fields.get('COLOR') ?? '#000000';
			push(t.setColor(c));
			break;
		}
		case 'controls_repeat_ext': {
			const n = readNumberShadow(block.values.get('TIMES'), '?');
			push(t.repeat(n));
			describeStatement(block.statements.get('DO'), locale, indent + 1, out);
			break;
		}
		case 'controls_whileUntil':
			push(t.whileTrue);
			describeStatement(block.statements.get('DO'), locale, indent + 1, out);
			break;
		case 'controls_if':
			if (block.statements.has('ELSE')) {
				push(t.ifThenElse);
				describeStatement(block.statements.get('DO0'), locale, indent + 1, out);
				describeStatement(block.statements.get('ELSE'), locale, indent + 1, out);
			} else {
				push(t.ifThen);
				describeStatement(block.statements.get('DO0'), locale, indent + 1, out);
			}
			break;
		case 'variables_set':
			push(t.setVar(block.fields.get('VAR') ?? '?'));
			break;
		case 'math_change':
			push(t.changeVar(block.fields.get('VAR') ?? '?'));
			break;
		case 'text_print':
			push(t.print);
			break;
		case 'text_prompt_ext':
			push(t.prompt);
			break;
		default:
			push(t.unknown(block.type));
			break;
	}

	if (block.next) describeBlock(block.next, locale, indent, out);
}

function describeStatement(
	statement: ParsedBlock | undefined,
	locale: ReadoutLocale,
	indent: number,
	out: string[]
) {
	if (!statement) return;
	describeBlock(statement, locale, indent, out);
}

/**
 * Produce a friendly bullet-list description of the workspace.
 */
export function describeWorkspace(xml: string, locale: ReadoutLocale): string[] {
	const trimmed = xml.trim();
	if (!trimmed) return [T[locale].empty];

	const roots = parseWorkspace(trimmed);
	if (roots.length === 0) return [T[locale].empty];

	const out: string[] = [];
	roots.forEach((root, index) => {
		if (roots.length > 1 && index > 0) {
			out.push(T[locale].standalone);
		}
		describeBlock(root, locale, 0, out);
	});
	return out;
}
