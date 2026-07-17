// Primitive literal encoded inside a block input
export type Primitive = [number, string | number] | [number, string, string];

export type BlockInput =
  | [number, Primitive]
  | [number, string]
  | [number, string | null, string]
  | [number, string, Primitive]
  | [number, string | null];

export interface BlockMutation {
  tagName: "mutation";
  children: [];
  proccode: string;
  argumentids: string;
  argumentnames?: string;
}

export interface Block {
  id: string;
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, BlockInput>;
  fields: Record<string, [string, string | null]>; // { key: [name, id] }
  shadow: boolean;
  topLevel: boolean;
  x?: number;
  y?: number;
  mutation?: BlockMutation;
}

export interface Costume {
  name: string;
}

export type ScratchVariable = [string, string | number | boolean]; //[displayName, currentValue]

export type ScratchList = [string, (string | number | boolean)[]]; // { uniqueId: [displayName, items[]] }

export interface TargetBase {
  name: string;
  variables: Record<string, ScratchVariable>;
  lists: Record<string, ScratchList>;
  broadcasts: Record<string, string>; // { uniqueId: displayName }
  blocks: Record<string, Block>;
  currentCostume: number;
  costumes: Costume[];
}

export interface Stage extends TargetBase {
  isStage: true;
}

export interface Sprite extends TargetBase {
  isStage: false;
  visible: boolean;
  x: number;
  y: number;
  size: number;
  direction: number;
  draggable: boolean;
  rotationStyle: string;
}

export type Target = Stage | Sprite;

export type Script = Block[];

export interface Meta {
  semver: string;
  vm: string;
  agent: string;
}

export interface ScratchProject {
  targets: Target[];
  meta: Meta;
}
