export interface ServoyDoc {
    servoydoc: {
        runtime: {
            object: ServoyDocObject[];
        };
    };
}

export interface ServoyDocObject {
    _clientSupport?: string;
    _deprecated?: string;
    _publicName?: string;
    _qualifiedName?: string;
    _extendsComponent?: string;
    _scriptingName?: string;
    constants?: { constant: ServoyDocConstant[] };
    functions?: { function: ServoyDocFunction[] };
    properties?: { property: ServoyDocProperty[] };
    description?: string;
}

export interface ServoyDocProperty {
    _name: string;
    return: ServoyDocType;
    descriptions?: { description?: ServoyDocDescription };
    summaries?: { summary: ServoyDocSummary };
    samples?: { sample: ServoyDocSample };
    _clientSupport?: string;
}

export interface ServoyDocConstant {
    _name: string;
    return: ServoyDocType;
    descriptions?: { description?: ServoyDocDescription };
    summaries?: { summary?: ServoyDocSummary };
    deprecated?: string;
    samples?: { sample?: ServoyDocSample };
    _clientSupport?: string;
    _deprecated?: string;
}

export interface ServoyDocFunction {
    _name: string;
    argumentsTypes?: { argumentType: ServoyDocType | ServoyDocType[] };
    return: ServoyDocType;
    descriptions?: { description?: ServoyDocDescription };
    summaries?: { summary?: ServoyDocSummary };
    samples?: { sample?: ServoyDocSample };
    parameters?: { parameter: ServoyDocParameter | ServoyDocParameter[] };
    _clientSupport?: string;
    _deprecated?: string;
}

export interface ServoyDocParameter {
    _name: string;
    _type: string;
    _typecode: string;
    description?: string;
    _optional?: string;
}

export interface ServoyDocType {
    _type: string;
    _typecode: string;
    __cdata?: string;
}

export interface ServoyDocDescription {
    _clientSupport?: string;
    __cdata: string;
}

export interface ServoyDocSummary {
    _clientSupport?: string;
    __cdata: string;
}

export interface ServoyDocSample {
    _clientSupport?: string;
    __cdata: string;
}