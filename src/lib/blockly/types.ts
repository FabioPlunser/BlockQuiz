export enum BlocklyToolboxKind {
	CATEGORY = 'categoryToolbox',
	FLYOUT = 'flyoutToolbox'
}

export interface BlockDef {
	id: string;
	message: string;
	args?: BlockArg[];
	color: number;
	tooltip?: string;
	method: string;
}

export interface BlockArg {
	type: 'number' | 'string' | 'color' | 'boolean' | 'dropdown';
	name: string;
	default?: string | number;
	options?: [string, string][];
}
export type BlocklyWorkspace = {
	toolbox: string[];
	starterXml?: string;
	readOnly?: boolean;
};

export type BlocklyWorkspaceState = {
	toolbox: string[];
	starterXml?: string;
	readOnly?: boolean;
};

export type BlockCategory = {
	kind: 'block';
	type: string;
	inputs?: Record<string, any>;
};

export type BlocklyCategoryConfig = {
	kind: 'category';
	name: string;
	colour: number;
	contents: BlockCategory[];
};

export type BlocklyToolboxConfig = {
	kind: BlocklyToolboxKind;
	contents: BlocklyCategoryConfig[];
};

export type BlocklyConfig = {
	grid: {
		spacing: number;
		length: number;
		colour: string;
		snap: boolean;
	};
	trashcan: boolean;
	zoom: {
		controls: boolean;
		wheel: boolean;
		startScale: number;
		maxScale: number;
		minScale: number;
		scaleSpeed: number;
	};
	readonly: boolean;
};
