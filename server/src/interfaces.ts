import { Position } from 'acorn';
import { TypeInfo } from './util/types';

export interface IResult {
    functions: IFunction[]
    variables: IVariable[]
    classes: IClass[]
}



export interface IFunction {
    name: string
    params: IParam[]
    returns: string
    description: string,
    typeInfo?: TypeInfo
    filePath?: string,
    position?: Position
}
export interface IVariable {
    name: string
    type: string
    description: string
    deprecated?: string,
    typeInfo?: TypeInfo
    filePath?: string,
    position?: Position
}
export interface IClass {
    name: string
    description: string
    params: IParam[]
    methods: IFunction[]
    variables: IVariable[]
    extends?: string
    filePath?: string
    position?: Position
}
export interface IParam {
    name: string
    type: string
    description: string
    typeInfo?: TypeInfo
    optional?: boolean
}