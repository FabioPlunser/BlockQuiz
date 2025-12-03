export interface Point { 
	x: number; 
	y: number; 
} 

export interface Command { 
	type: 'string'; 
	args: string[];
	timestamp: number;
}

export interface Canvas2DSate { 
	x: number;
	y: number;
	angle: number;
}


export interface TurtleSate extends Canvas2DState { 
	tolerance: number; 
	penDown: boolean;
	color: string;
}

export interface PathOverlay { 
	points: Point[]; 
	color?: string; 
	width?: number;
}

export interface TargetPoint {
	x: number; 
	y: number;
	tolerance?: number;
} 

export interface ComparisonResult { 
	score: number;
	passed: boolean;
	details: {
		positionMatch: boolean;
		angleMatch: boolean;
		distance: number;
	};
}
