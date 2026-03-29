import { z } from 'zod';
export declare const ISO8601Schema: z.ZodString;
export declare const PortSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    required: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: string;
    required: boolean;
    description?: string | undefined;
}, {
    id: string;
    type: string;
    required?: boolean | undefined;
    description?: string | undefined;
}>;
export type Port = z.infer<typeof PortSchema>;
export declare const CommandOptionSchema: z.ZodObject<{
    flag: z.ZodString;
    type: z.ZodString;
    required: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    required: boolean;
    flag: string;
    description?: string | undefined;
    default?: unknown;
}, {
    type: string;
    flag: string;
    required?: boolean | undefined;
    description?: string | undefined;
    default?: unknown;
}>;
export declare const CommandSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    options: z.ZodDefault<z.ZodArray<z.ZodObject<{
        flag: z.ZodString;
        type: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        required: boolean;
        flag: string;
        description?: string | undefined;
        default?: unknown;
    }, {
        type: string;
        flag: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: unknown;
    }>, "many">>;
    wiringRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    options: {
        type: string;
        required: boolean;
        flag: string;
        description?: string | undefined;
        default?: unknown;
    }[];
    name: string;
    wiringRef?: string | undefined;
}, {
    description: string;
    name: string;
    options?: {
        type: string;
        flag: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: unknown;
    }[] | undefined;
    wiringRef?: string | undefined;
}>;
export declare const EnvVarSchema: z.ZodObject<{
    name: z.ZodString;
    required: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    required: boolean;
    name: string;
    description?: string | undefined;
    default?: string | undefined;
}, {
    name: string;
    required?: boolean | undefined;
    description?: string | undefined;
    default?: string | undefined;
}>;
export declare const FunctionalSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodString;
    displayName: z.ZodString;
    description: z.ZodString;
    entrypoint: z.ZodString;
    modes: z.ZodDefault<z.ZodArray<z.ZodEnum<["auto", "manual"]>, "many">>;
    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }, {
        id: string;
        type: string;
        required?: boolean | undefined;
        description?: string | undefined;
    }>, "many">>;
    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }, {
        id: string;
        type: string;
        required?: boolean | undefined;
        description?: string | undefined;
    }>, "many">>;
    commands: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        options: z.ZodDefault<z.ZodArray<z.ZodObject<{
            flag: z.ZodString;
            type: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            required: boolean;
            flag: string;
            description?: string | undefined;
            default?: unknown;
        }, {
            type: string;
            flag: string;
            required?: boolean | undefined;
            description?: string | undefined;
            default?: unknown;
        }>, "many">>;
        wiringRef: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        options: {
            type: string;
            required: boolean;
            flag: string;
            description?: string | undefined;
            default?: unknown;
        }[];
        name: string;
        wiringRef?: string | undefined;
    }, {
        description: string;
        name: string;
        options?: {
            type: string;
            flag: string;
            required?: boolean | undefined;
            description?: string | undefined;
            default?: unknown;
        }[] | undefined;
        wiringRef?: string | undefined;
    }>, "many">>;
    defaultCommand: z.ZodOptional<z.ZodString>;
    types: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    env: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        required: boolean;
        name: string;
        description?: string | undefined;
        default?: string | undefined;
    }, {
        name: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    version: string;
    displayName: string;
    entrypoint: string;
    modes: ("auto" | "manual")[];
    inputs: {
        id: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }[];
    outputs: {
        id: string;
        type: string;
        required: boolean;
        description?: string | undefined;
    }[];
    commands: {
        description: string;
        options: {
            type: string;
            required: boolean;
            flag: string;
            description?: string | undefined;
            default?: unknown;
        }[];
        name: string;
        wiringRef?: string | undefined;
    }[];
    types: Record<string, unknown>;
    env: {
        required: boolean;
        name: string;
        description?: string | undefined;
        default?: string | undefined;
    }[];
    defaultCommand?: string | undefined;
}, {
    id: string;
    description: string;
    version: string;
    displayName: string;
    entrypoint: string;
    modes?: ("auto" | "manual")[] | undefined;
    inputs?: {
        id: string;
        type: string;
        required?: boolean | undefined;
        description?: string | undefined;
    }[] | undefined;
    outputs?: {
        id: string;
        type: string;
        required?: boolean | undefined;
        description?: string | undefined;
    }[] | undefined;
    commands?: {
        description: string;
        name: string;
        options?: {
            type: string;
            flag: string;
            required?: boolean | undefined;
            description?: string | undefined;
            default?: unknown;
        }[] | undefined;
        wiringRef?: string | undefined;
    }[] | undefined;
    defaultCommand?: string | undefined;
    types?: Record<string, unknown> | undefined;
    env?: {
        name: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: string | undefined;
    }[] | undefined;
}>;
export type Functional = z.infer<typeof FunctionalSchema>;
export declare const ParentRefSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodString;
    descriptorHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    version: string;
    descriptorHash?: string | undefined;
}, {
    id: string;
    version: string;
    descriptorHash?: string | undefined;
}>;
export declare const LineageSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"leaf">;
    createdAt: z.ZodString;
    authors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        handle: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        handle: string;
    }, {
        handle: string;
    }>, "many">>;
    history: z.ZodDefault<z.ZodArray<z.ZodUnknown, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "leaf";
    createdAt: string;
    authors: {
        handle: string;
    }[];
    history: unknown[];
}, {
    kind: "leaf";
    createdAt: string;
    authors?: {
        handle: string;
    }[] | undefined;
    history?: unknown[] | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"composed">;
    createdAt: z.ZodString;
    authors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        handle: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        handle: string;
    }, {
        handle: string;
    }>, "many">>;
    parents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodString;
        descriptorHash: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        version: string;
        descriptorHash?: string | undefined;
    }, {
        id: string;
        version: string;
        descriptorHash?: string | undefined;
    }>, "many">;
    aiPrompt: z.ZodString;
    aiProposal: z.ZodString;
    approvedWiringRef: z.ZodDefault<z.ZodString>;
    humanEdits: z.ZodOptional<z.ZodString>;
    usedAsParentIn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "composed";
    createdAt: string;
    authors: {
        handle: string;
    }[];
    parents: {
        id: string;
        version: string;
        descriptorHash?: string | undefined;
    }[];
    aiPrompt: string;
    aiProposal: string;
    approvedWiringRef: string;
    usedAsParentIn: string[];
    humanEdits?: string | undefined;
}, {
    kind: "composed";
    createdAt: string;
    parents: {
        id: string;
        version: string;
        descriptorHash?: string | undefined;
    }[];
    aiPrompt: string;
    aiProposal: string;
    authors?: {
        handle: string;
    }[] | undefined;
    approvedWiringRef?: string | undefined;
    humanEdits?: string | undefined;
    usedAsParentIn?: string[] | undefined;
}>]>;
export type Lineage = z.infer<typeof LineageSchema>;
export declare const CliDescriptorSchema: z.ZodObject<{
    apiVersion: z.ZodLiteral<"ark/v1">;
    kind: z.ZodLiteral<"CliDescriptor">;
    functional: z.ZodObject<{
        id: z.ZodString;
        version: z.ZodString;
        displayName: z.ZodString;
        description: z.ZodString;
        entrypoint: z.ZodString;
        modes: z.ZodDefault<z.ZodArray<z.ZodEnum<["auto", "manual"]>, "many">>;
        inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }, {
            id: string;
            type: string;
            required?: boolean | undefined;
            description?: string | undefined;
        }>, "many">>;
        outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }, {
            id: string;
            type: string;
            required?: boolean | undefined;
            description?: string | undefined;
        }>, "many">>;
        commands: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            options: z.ZodDefault<z.ZodArray<z.ZodObject<{
                flag: z.ZodString;
                type: z.ZodString;
                required: z.ZodDefault<z.ZodBoolean>;
                description: z.ZodOptional<z.ZodString>;
                default: z.ZodOptional<z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                type: string;
                required: boolean;
                flag: string;
                description?: string | undefined;
                default?: unknown;
            }, {
                type: string;
                flag: string;
                required?: boolean | undefined;
                description?: string | undefined;
                default?: unknown;
            }>, "many">>;
            wiringRef: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            options: {
                type: string;
                required: boolean;
                flag: string;
                description?: string | undefined;
                default?: unknown;
            }[];
            name: string;
            wiringRef?: string | undefined;
        }, {
            description: string;
            name: string;
            options?: {
                type: string;
                flag: string;
                required?: boolean | undefined;
                description?: string | undefined;
                default?: unknown;
            }[] | undefined;
            wiringRef?: string | undefined;
        }>, "many">>;
        defaultCommand: z.ZodOptional<z.ZodString>;
        types: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        env: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            required: boolean;
            name: string;
            description?: string | undefined;
            default?: string | undefined;
        }, {
            name: string;
            required?: boolean | undefined;
            description?: string | undefined;
            default?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        version: string;
        displayName: string;
        entrypoint: string;
        modes: ("auto" | "manual")[];
        inputs: {
            id: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        outputs: {
            id: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        commands: {
            description: string;
            options: {
                type: string;
                required: boolean;
                flag: string;
                description?: string | undefined;
                default?: unknown;
            }[];
            name: string;
            wiringRef?: string | undefined;
        }[];
        types: Record<string, unknown>;
        env: {
            required: boolean;
            name: string;
            description?: string | undefined;
            default?: string | undefined;
        }[];
        defaultCommand?: string | undefined;
    }, {
        id: string;
        description: string;
        version: string;
        displayName: string;
        entrypoint: string;
        modes?: ("auto" | "manual")[] | undefined;
        inputs?: {
            id: string;
            type: string;
            required?: boolean | undefined;
            description?: string | undefined;
        }[] | undefined;
        outputs?: {
            id: string;
            type: string;
            required?: boolean | undefined;
            description?: string | undefined;
        }[] | undefined;
        commands?: {
            description: string;
            name: string;
            options?: {
                type: string;
                flag: string;
                required?: boolean | undefined;
                description?: string | undefined;
                default?: unknown;
            }[] | undefined;
            wiringRef?: string | undefined;
        }[] | undefined;
        defaultCommand?: string | undefined;
        types?: Record<string, unknown> | undefined;
        env?: {
            name: string;
            required?: boolean | undefined;
            description?: string | undefined;
            default?: string | undefined;
        }[] | undefined;
    }>;
    lineage: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"leaf">;
        createdAt: z.ZodString;
        authors: z.ZodDefault<z.ZodArray<z.ZodObject<{
            handle: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            handle: string;
        }, {
            handle: string;
        }>, "many">>;
        history: z.ZodDefault<z.ZodArray<z.ZodUnknown, "many">>;
    }, "strip", z.ZodTypeAny, {
        kind: "leaf";
        createdAt: string;
        authors: {
            handle: string;
        }[];
        history: unknown[];
    }, {
        kind: "leaf";
        createdAt: string;
        authors?: {
            handle: string;
        }[] | undefined;
        history?: unknown[] | undefined;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"composed">;
        createdAt: z.ZodString;
        authors: z.ZodDefault<z.ZodArray<z.ZodObject<{
            handle: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            handle: string;
        }, {
            handle: string;
        }>, "many">>;
        parents: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            version: z.ZodString;
            descriptorHash: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            version: string;
            descriptorHash?: string | undefined;
        }, {
            id: string;
            version: string;
            descriptorHash?: string | undefined;
        }>, "many">;
        aiPrompt: z.ZodString;
        aiProposal: z.ZodString;
        approvedWiringRef: z.ZodDefault<z.ZodString>;
        humanEdits: z.ZodOptional<z.ZodString>;
        usedAsParentIn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        kind: "composed";
        createdAt: string;
        authors: {
            handle: string;
        }[];
        parents: {
            id: string;
            version: string;
            descriptorHash?: string | undefined;
        }[];
        aiPrompt: string;
        aiProposal: string;
        approvedWiringRef: string;
        usedAsParentIn: string[];
        humanEdits?: string | undefined;
    }, {
        kind: "composed";
        createdAt: string;
        parents: {
            id: string;
            version: string;
            descriptorHash?: string | undefined;
        }[];
        aiPrompt: string;
        aiProposal: string;
        authors?: {
            handle: string;
        }[] | undefined;
        approvedWiringRef?: string | undefined;
        humanEdits?: string | undefined;
        usedAsParentIn?: string[] | undefined;
    }>]>;
}, "strip", z.ZodTypeAny, {
    kind: "CliDescriptor";
    apiVersion: "ark/v1";
    functional: {
        id: string;
        description: string;
        version: string;
        displayName: string;
        entrypoint: string;
        modes: ("auto" | "manual")[];
        inputs: {
            id: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        outputs: {
            id: string;
            type: string;
            required: boolean;
            description?: string | undefined;
        }[];
        commands: {
            description: string;
            options: {
                type: string;
                required: boolean;
                flag: string;
                description?: string | undefined;
                default?: unknown;
            }[];
            name: string;
            wiringRef?: string | undefined;
        }[];
        types: Record<string, unknown>;
        env: {
            required: boolean;
            name: string;
            description?: string | undefined;
            default?: string | undefined;
        }[];
        defaultCommand?: string | undefined;
    };
    lineage: {
        kind: "leaf";
        createdAt: string;
        authors: {
            handle: string;
        }[];
        history: unknown[];
    } | {
        kind: "composed";
        createdAt: string;
        authors: {
            handle: string;
        }[];
        parents: {
            id: string;
            version: string;
            descriptorHash?: string | undefined;
        }[];
        aiPrompt: string;
        aiProposal: string;
        approvedWiringRef: string;
        usedAsParentIn: string[];
        humanEdits?: string | undefined;
    };
}, {
    kind: "CliDescriptor";
    apiVersion: "ark/v1";
    functional: {
        id: string;
        description: string;
        version: string;
        displayName: string;
        entrypoint: string;
        modes?: ("auto" | "manual")[] | undefined;
        inputs?: {
            id: string;
            type: string;
            required?: boolean | undefined;
            description?: string | undefined;
        }[] | undefined;
        outputs?: {
            id: string;
            type: string;
            required?: boolean | undefined;
            description?: string | undefined;
        }[] | undefined;
        commands?: {
            description: string;
            name: string;
            options?: {
                type: string;
                flag: string;
                required?: boolean | undefined;
                description?: string | undefined;
                default?: unknown;
            }[] | undefined;
            wiringRef?: string | undefined;
        }[] | undefined;
        defaultCommand?: string | undefined;
        types?: Record<string, unknown> | undefined;
        env?: {
            name: string;
            required?: boolean | undefined;
            description?: string | undefined;
            default?: string | undefined;
        }[] | undefined;
    };
    lineage: {
        kind: "leaf";
        createdAt: string;
        authors?: {
            handle: string;
        }[] | undefined;
        history?: unknown[] | undefined;
    } | {
        kind: "composed";
        createdAt: string;
        parents: {
            id: string;
            version: string;
            descriptorHash?: string | undefined;
        }[];
        aiPrompt: string;
        aiProposal: string;
        authors?: {
            handle: string;
        }[] | undefined;
        approvedWiringRef?: string | undefined;
        humanEdits?: string | undefined;
        usedAsParentIn?: string[] | undefined;
    };
}>;
export type CliDescriptor = z.infer<typeof CliDescriptorSchema>;
export declare const OutputBindingSchema: z.ZodObject<{
    bind: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>;
}, "strip", z.ZodTypeAny, {
    bind: Record<string, string | Record<string, unknown>>;
}, {
    bind: Record<string, string | Record<string, unknown>>;
}>;
export declare const BranchCaseSchema: z.ZodObject<{
    condition: z.ZodString;
    next: z.ZodString;
}, "strip", z.ZodTypeAny, {
    condition: string;
    next: string;
}, {
    condition: string;
    next: string;
}>;
export type BranchCase = z.infer<typeof BranchCaseSchema>;
export declare const WiringStepSchema: z.ZodObject<{
    id: z.ZodString;
    uses: z.ZodString;
    command: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    condition: z.ZodOptional<z.ZodString>;
    inputs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    outputs: z.ZodOptional<z.ZodObject<{
        bind: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>;
    }, "strip", z.ZodTypeAny, {
        bind: Record<string, string | Record<string, unknown>>;
    }, {
        bind: Record<string, string | Record<string, unknown>>;
    }>>;
    timeout: z.ZodOptional<z.ZodString>;
    dependsOn: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    cases: z.ZodOptional<z.ZodArray<z.ZodObject<{
        condition: z.ZodString;
        next: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        condition: string;
        next: string;
    }, {
        condition: string;
        next: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    inputs: Record<string, unknown>;
    uses: string;
    description?: string | undefined;
    outputs?: {
        bind: Record<string, string | Record<string, unknown>>;
    } | undefined;
    condition?: string | undefined;
    command?: string | undefined;
    timeout?: string | undefined;
    dependsOn?: string[] | undefined;
    cases?: {
        condition: string;
        next: string;
    }[] | undefined;
}, {
    id: string;
    uses: string;
    description?: string | undefined;
    inputs?: Record<string, unknown> | undefined;
    outputs?: {
        bind: Record<string, string | Record<string, unknown>>;
    } | undefined;
    condition?: string | undefined;
    command?: string | undefined;
    timeout?: string | undefined;
    dependsOn?: string[] | undefined;
    cases?: {
        condition: string;
        next: string;
    }[] | undefined;
}>;
export type WiringStep = z.infer<typeof WiringStepSchema>;
export declare const RetryPolicySchema: z.ZodObject<{
    maxAttempts: z.ZodDefault<z.ZodNumber>;
    backoffMs: z.ZodDefault<z.ZodNumber>;
    jitter: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxAttempts: number;
    backoffMs: number;
    jitter: boolean;
}, {
    maxAttempts?: number | undefined;
    backoffMs?: number | undefined;
    jitter?: boolean | undefined;
}>;
export declare const ErrorPolicySchema: z.ZodObject<{
    onStepFailure: z.ZodDefault<z.ZodEnum<["abort", "continue", "retry"]>>;
    retryPolicy: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodDefault<z.ZodNumber>;
        backoffMs: z.ZodDefault<z.ZodNumber>;
        jitter: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maxAttempts: number;
        backoffMs: number;
        jitter: boolean;
    }, {
        maxAttempts?: number | undefined;
        backoffMs?: number | undefined;
        jitter?: boolean | undefined;
    }>>;
    parallelBehavior: z.ZodDefault<z.ZodEnum<["failFast", "waitAll"]>>;
}, "strip", z.ZodTypeAny, {
    onStepFailure: "abort" | "continue" | "retry";
    parallelBehavior: "failFast" | "waitAll";
    retryPolicy?: {
        maxAttempts: number;
        backoffMs: number;
        jitter: boolean;
    } | undefined;
}, {
    onStepFailure?: "abort" | "continue" | "retry" | undefined;
    retryPolicy?: {
        maxAttempts?: number | undefined;
        backoffMs?: number | undefined;
        jitter?: boolean | undefined;
    } | undefined;
    parallelBehavior?: "failFast" | "waitAll" | undefined;
}>;
export declare const AutoModeDecisionStepSchema: z.ZodObject<{
    before: z.ZodString;
    prompt: z.ZodString;
    outputBindings: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    before: string;
    prompt: string;
    outputBindings: Record<string, string>;
}, {
    before: string;
    prompt: string;
    outputBindings: Record<string, string>;
}>;
export declare const WiringFlagSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    required: z.ZodDefault<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: string;
    required: boolean;
    name: string;
    description?: string | undefined;
    default?: unknown;
}, {
    type: string;
    name: string;
    required?: boolean | undefined;
    description?: string | undefined;
    default?: unknown;
}>;
export declare const StreamingConfigSchema: z.ZodObject<{
    intervalMs: z.ZodOptional<z.ZodNumber>;
    until: z.ZodOptional<z.ZodString>;
    stopOn: z.ZodOptional<z.ZodArray<z.ZodObject<{
        signal: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        signal: string;
    }, {
        signal: string;
    }>, "many">>;
    restartOnFailure: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    restartOnFailure: boolean;
    intervalMs?: number | undefined;
    until?: string | undefined;
    stopOn?: {
        signal: string;
    }[] | undefined;
}, {
    intervalMs?: number | undefined;
    until?: string | undefined;
    stopOn?: {
        signal: string;
    }[] | undefined;
    restartOnFailure?: boolean | undefined;
}>;
export type StreamingConfig = z.infer<typeof StreamingConfigSchema>;
export declare const WiringPlanSchema: z.ZodEffects<z.ZodObject<{
    apiVersion: z.ZodLiteral<"ark/v1">;
    kind: z.ZodLiteral<"WiringPlan">;
    generatedBy: z.ZodOptional<z.ZodString>;
    generatedAt: z.ZodOptional<z.ZodString>;
    approvedAt: z.ZodOptional<z.ZodString>;
    pipeline: z.ZodEffects<z.ZodObject<{
        topology: z.ZodOptional<z.ZodEnum<["sequential", "dag"]>>;
        /** @deprecated Use topology instead. Will be removed in a future version. */
        mode: z.ZodOptional<z.ZodEnum<["sequential", "dag"]>>;
        lifecycle: z.ZodDefault<z.ZodEnum<["finite", "streaming"]>>;
        concurrency: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        lifecycle: "finite" | "streaming";
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        concurrency?: number | undefined;
    }, {
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        lifecycle?: "finite" | "streaming" | undefined;
        concurrency?: number | undefined;
    }>, {
        lifecycle: "finite" | "streaming";
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        concurrency?: number | undefined;
    }, {
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        lifecycle?: "finite" | "streaming" | undefined;
        concurrency?: number | undefined;
    }>;
    streaming: z.ZodOptional<z.ZodObject<{
        intervalMs: z.ZodOptional<z.ZodNumber>;
        until: z.ZodOptional<z.ZodString>;
        stopOn: z.ZodOptional<z.ZodArray<z.ZodObject<{
            signal: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            signal: string;
        }, {
            signal: string;
        }>, "many">>;
        restartOnFailure: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        restartOnFailure: boolean;
        intervalMs?: number | undefined;
        until?: string | undefined;
        stopOn?: {
            signal: string;
        }[] | undefined;
    }, {
        intervalMs?: number | undefined;
        until?: string | undefined;
        stopOn?: {
            signal: string;
        }[] | undefined;
        restartOnFailure?: boolean | undefined;
    }>>;
    steps: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        uses: z.ZodString;
        command: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        condition: z.ZodOptional<z.ZodString>;
        inputs: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        outputs: z.ZodOptional<z.ZodObject<{
            bind: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>]>>;
        }, "strip", z.ZodTypeAny, {
            bind: Record<string, string | Record<string, unknown>>;
        }, {
            bind: Record<string, string | Record<string, unknown>>;
        }>>;
        timeout: z.ZodOptional<z.ZodString>;
        dependsOn: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        cases: z.ZodOptional<z.ZodArray<z.ZodObject<{
            condition: z.ZodString;
            next: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            condition: string;
            next: string;
        }, {
            condition: string;
            next: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        inputs: Record<string, unknown>;
        uses: string;
        description?: string | undefined;
        outputs?: {
            bind: Record<string, string | Record<string, unknown>>;
        } | undefined;
        condition?: string | undefined;
        command?: string | undefined;
        timeout?: string | undefined;
        dependsOn?: string[] | undefined;
        cases?: {
            condition: string;
            next: string;
        }[] | undefined;
    }, {
        id: string;
        uses: string;
        description?: string | undefined;
        inputs?: Record<string, unknown> | undefined;
        outputs?: {
            bind: Record<string, string | Record<string, unknown>>;
        } | undefined;
        condition?: string | undefined;
        command?: string | undefined;
        timeout?: string | undefined;
        dependsOn?: string[] | undefined;
        cases?: {
            condition: string;
            next: string;
        }[] | undefined;
    }>, "many">;
    errorPolicy: z.ZodOptional<z.ZodObject<{
        onStepFailure: z.ZodDefault<z.ZodEnum<["abort", "continue", "retry"]>>;
        retryPolicy: z.ZodOptional<z.ZodObject<{
            maxAttempts: z.ZodDefault<z.ZodNumber>;
            backoffMs: z.ZodDefault<z.ZodNumber>;
            jitter: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            maxAttempts: number;
            backoffMs: number;
            jitter: boolean;
        }, {
            maxAttempts?: number | undefined;
            backoffMs?: number | undefined;
            jitter?: boolean | undefined;
        }>>;
        parallelBehavior: z.ZodDefault<z.ZodEnum<["failFast", "waitAll"]>>;
    }, "strip", z.ZodTypeAny, {
        onStepFailure: "abort" | "continue" | "retry";
        parallelBehavior: "failFast" | "waitAll";
        retryPolicy?: {
            maxAttempts: number;
            backoffMs: number;
            jitter: boolean;
        } | undefined;
    }, {
        onStepFailure?: "abort" | "continue" | "retry" | undefined;
        retryPolicy?: {
            maxAttempts?: number | undefined;
            backoffMs?: number | undefined;
            jitter?: boolean | undefined;
        } | undefined;
        parallelBehavior?: "failFast" | "waitAll" | undefined;
    }>>;
    autoMode: z.ZodOptional<z.ZodObject<{
        decisionStep: z.ZodObject<{
            before: z.ZodString;
            prompt: z.ZodString;
            outputBindings: z.ZodRecord<z.ZodString, z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        }, {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        }>;
    }, "strip", z.ZodTypeAny, {
        decisionStep: {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        };
    }, {
        decisionStep: {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        };
    }>>;
    flags: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
        description: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        required: boolean;
        name: string;
        description?: string | undefined;
        default?: unknown;
    }, {
        type: string;
        name: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: unknown;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "WiringPlan";
    apiVersion: "ark/v1";
    pipeline: {
        lifecycle: "finite" | "streaming";
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        concurrency?: number | undefined;
    };
    steps: {
        id: string;
        inputs: Record<string, unknown>;
        uses: string;
        description?: string | undefined;
        outputs?: {
            bind: Record<string, string | Record<string, unknown>>;
        } | undefined;
        condition?: string | undefined;
        command?: string | undefined;
        timeout?: string | undefined;
        dependsOn?: string[] | undefined;
        cases?: {
            condition: string;
            next: string;
        }[] | undefined;
    }[];
    flags: {
        type: string;
        required: boolean;
        name: string;
        description?: string | undefined;
        default?: unknown;
    }[];
    generatedBy?: string | undefined;
    generatedAt?: string | undefined;
    approvedAt?: string | undefined;
    streaming?: {
        restartOnFailure: boolean;
        intervalMs?: number | undefined;
        until?: string | undefined;
        stopOn?: {
            signal: string;
        }[] | undefined;
    } | undefined;
    errorPolicy?: {
        onStepFailure: "abort" | "continue" | "retry";
        parallelBehavior: "failFast" | "waitAll";
        retryPolicy?: {
            maxAttempts: number;
            backoffMs: number;
            jitter: boolean;
        } | undefined;
    } | undefined;
    autoMode?: {
        decisionStep: {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        };
    } | undefined;
}, {
    kind: "WiringPlan";
    apiVersion: "ark/v1";
    pipeline: {
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        lifecycle?: "finite" | "streaming" | undefined;
        concurrency?: number | undefined;
    };
    steps: {
        id: string;
        uses: string;
        description?: string | undefined;
        inputs?: Record<string, unknown> | undefined;
        outputs?: {
            bind: Record<string, string | Record<string, unknown>>;
        } | undefined;
        condition?: string | undefined;
        command?: string | undefined;
        timeout?: string | undefined;
        dependsOn?: string[] | undefined;
        cases?: {
            condition: string;
            next: string;
        }[] | undefined;
    }[];
    generatedBy?: string | undefined;
    generatedAt?: string | undefined;
    approvedAt?: string | undefined;
    streaming?: {
        intervalMs?: number | undefined;
        until?: string | undefined;
        stopOn?: {
            signal: string;
        }[] | undefined;
        restartOnFailure?: boolean | undefined;
    } | undefined;
    errorPolicy?: {
        onStepFailure?: "abort" | "continue" | "retry" | undefined;
        retryPolicy?: {
            maxAttempts?: number | undefined;
            backoffMs?: number | undefined;
            jitter?: boolean | undefined;
        } | undefined;
        parallelBehavior?: "failFast" | "waitAll" | undefined;
    } | undefined;
    autoMode?: {
        decisionStep: {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        };
    } | undefined;
    flags?: {
        type: string;
        name: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: unknown;
    }[] | undefined;
}>, {
    kind: "WiringPlan";
    apiVersion: "ark/v1";
    pipeline: {
        lifecycle: "finite" | "streaming";
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        concurrency?: number | undefined;
    };
    steps: {
        id: string;
        inputs: Record<string, unknown>;
        uses: string;
        description?: string | undefined;
        outputs?: {
            bind: Record<string, string | Record<string, unknown>>;
        } | undefined;
        condition?: string | undefined;
        command?: string | undefined;
        timeout?: string | undefined;
        dependsOn?: string[] | undefined;
        cases?: {
            condition: string;
            next: string;
        }[] | undefined;
    }[];
    flags: {
        type: string;
        required: boolean;
        name: string;
        description?: string | undefined;
        default?: unknown;
    }[];
    generatedBy?: string | undefined;
    generatedAt?: string | undefined;
    approvedAt?: string | undefined;
    streaming?: {
        restartOnFailure: boolean;
        intervalMs?: number | undefined;
        until?: string | undefined;
        stopOn?: {
            signal: string;
        }[] | undefined;
    } | undefined;
    errorPolicy?: {
        onStepFailure: "abort" | "continue" | "retry";
        parallelBehavior: "failFast" | "waitAll";
        retryPolicy?: {
            maxAttempts: number;
            backoffMs: number;
            jitter: boolean;
        } | undefined;
    } | undefined;
    autoMode?: {
        decisionStep: {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        };
    } | undefined;
}, {
    kind: "WiringPlan";
    apiVersion: "ark/v1";
    pipeline: {
        topology?: "sequential" | "dag" | undefined;
        mode?: "sequential" | "dag" | undefined;
        lifecycle?: "finite" | "streaming" | undefined;
        concurrency?: number | undefined;
    };
    steps: {
        id: string;
        uses: string;
        description?: string | undefined;
        inputs?: Record<string, unknown> | undefined;
        outputs?: {
            bind: Record<string, string | Record<string, unknown>>;
        } | undefined;
        condition?: string | undefined;
        command?: string | undefined;
        timeout?: string | undefined;
        dependsOn?: string[] | undefined;
        cases?: {
            condition: string;
            next: string;
        }[] | undefined;
    }[];
    generatedBy?: string | undefined;
    generatedAt?: string | undefined;
    approvedAt?: string | undefined;
    streaming?: {
        intervalMs?: number | undefined;
        until?: string | undefined;
        stopOn?: {
            signal: string;
        }[] | undefined;
        restartOnFailure?: boolean | undefined;
    } | undefined;
    errorPolicy?: {
        onStepFailure?: "abort" | "continue" | "retry" | undefined;
        retryPolicy?: {
            maxAttempts?: number | undefined;
            backoffMs?: number | undefined;
            jitter?: boolean | undefined;
        } | undefined;
        parallelBehavior?: "failFast" | "waitAll" | undefined;
    } | undefined;
    autoMode?: {
        decisionStep: {
            before: string;
            prompt: string;
            outputBindings: Record<string, string>;
        };
    } | undefined;
    flags?: {
        type: string;
        name: string;
        required?: boolean | undefined;
        description?: string | undefined;
        default?: unknown;
    }[] | undefined;
}>;
export type WiringPlan = z.infer<typeof WiringPlanSchema>;
export declare const ComposeCommandSchema: z.ZodObject<{
    name: z.ZodString;
    intent: z.ZodString;
    constraints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    intent: string;
    constraints: string[];
}, {
    name: string;
    intent: string;
    constraints?: string[] | undefined;
}>;
export type ComposeCommand = z.infer<typeof ComposeCommandSchema>;
export declare const ComposeRequestSchema: z.ZodEffects<z.ZodObject<{
    apiVersion: z.ZodLiteral<"ark/v1">;
    kind: z.ZodLiteral<"ComposeRequest">;
    output: z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        targetDirectory: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        targetDirectory: string;
        description?: string | undefined;
    }, {
        id: string;
        displayName: string;
        targetDirectory: string;
        description?: string | undefined;
    }>;
    parents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, "many">;
    intent: z.ZodOptional<z.ZodString>;
    constraints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    commands: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        intent: z.ZodString;
        constraints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        intent: string;
        constraints: string[];
    }, {
        name: string;
        intent: string;
        constraints?: string[] | undefined;
    }>, "many">>;
    aiModel: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "ComposeRequest";
    parents: {
        id: string;
    }[];
    apiVersion: "ark/v1";
    constraints: string[];
    output: {
        id: string;
        displayName: string;
        targetDirectory: string;
        description?: string | undefined;
    };
    commands?: {
        name: string;
        intent: string;
        constraints: string[];
    }[] | undefined;
    intent?: string | undefined;
    aiModel?: string | undefined;
}, {
    kind: "ComposeRequest";
    parents: {
        id: string;
    }[];
    apiVersion: "ark/v1";
    output: {
        id: string;
        displayName: string;
        targetDirectory: string;
        description?: string | undefined;
    };
    commands?: {
        name: string;
        intent: string;
        constraints?: string[] | undefined;
    }[] | undefined;
    intent?: string | undefined;
    constraints?: string[] | undefined;
    aiModel?: string | undefined;
}>, {
    kind: "ComposeRequest";
    parents: {
        id: string;
    }[];
    apiVersion: "ark/v1";
    constraints: string[];
    output: {
        id: string;
        displayName: string;
        targetDirectory: string;
        description?: string | undefined;
    };
    commands?: {
        name: string;
        intent: string;
        constraints: string[];
    }[] | undefined;
    intent?: string | undefined;
    aiModel?: string | undefined;
}, {
    kind: "ComposeRequest";
    parents: {
        id: string;
    }[];
    apiVersion: "ark/v1";
    output: {
        id: string;
        displayName: string;
        targetDirectory: string;
        description?: string | undefined;
    };
    commands?: {
        name: string;
        intent: string;
        constraints?: string[] | undefined;
    }[] | undefined;
    intent?: string | undefined;
    constraints?: string[] | undefined;
    aiModel?: string | undefined;
}>;
export type ComposeRequest = z.infer<typeof ComposeRequestSchema>;
export declare const PipelineContextSchema: z.ZodObject<{
    mode: z.ZodEnum<["auto", "manual"]>;
    flags: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    stepOutputs: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    bindings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
    meta: z.ZodObject<{
        composedCliId: z.ZodString;
        runId: z.ZodString;
        startedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        composedCliId: string;
        runId: string;
        startedAt: string;
    }, {
        composedCliId: string;
        runId: string;
        startedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    mode: "auto" | "manual";
    flags: Record<string, unknown>;
    stepOutputs: Record<string, unknown>;
    bindings: Record<string, unknown>;
    dryRun: boolean;
    meta: {
        composedCliId: string;
        runId: string;
        startedAt: string;
    };
}, {
    mode: "auto" | "manual";
    flags: Record<string, unknown>;
    stepOutputs: Record<string, unknown>;
    bindings: Record<string, unknown>;
    meta: {
        composedCliId: string;
        runId: string;
        startedAt: string;
    };
    dryRun?: boolean | undefined;
}>;
export type PipelineContext = z.infer<typeof PipelineContextSchema>;
//# sourceMappingURL=schemas.d.ts.map