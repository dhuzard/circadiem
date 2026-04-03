import { z } from "zod";
export declare const scoreSchema: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
export declare const resultMetaSchema: z.ZodObject<{
    filename: z.ZodString;
    model: z.ZodString;
    aligned_to_dark: z.ZodBoolean;
    vcg_band: z.ZodEnum<["+-2SD", "+-1SD", "+-3SD"]>;
    run_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
    model: string;
    aligned_to_dark: boolean;
    vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
    run_id: string;
}, {
    filename: string;
    model: string;
    aligned_to_dark: boolean;
    vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
    run_id: string;
}>;
export declare const analysisResultSchema: z.ZodObject<{
    label: z.ZodString;
    baseline_light: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    dark_onset_burst: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    dark_irregularity: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    midnight_fragmentation: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    pre_light_decline: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    pre_dark_anticipation: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    notes: z.ZodString;
    flags: z.ZodArray<z.ZodString, "many">;
    confidence: z.ZodEnum<["low", "med", "high"]>;
    meta: z.ZodObject<{
        filename: z.ZodString;
        model: z.ZodString;
        aligned_to_dark: z.ZodBoolean;
        vcg_band: z.ZodEnum<["+-2SD", "+-1SD", "+-3SD"]>;
        run_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    }, {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    label: string;
    baseline_light: 0 | 1 | 2 | 3;
    dark_onset_burst: 0 | 1 | 2 | 3;
    dark_irregularity: 0 | 1 | 2 | 3;
    midnight_fragmentation: 0 | 1 | 2 | 3;
    pre_light_decline: 0 | 1 | 2 | 3;
    pre_dark_anticipation: 0 | 1 | 2 | 3;
    notes: string;
    flags: string[];
    confidence: "low" | "med" | "high";
    meta: {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    };
}, {
    label: string;
    baseline_light: 0 | 1 | 2 | 3;
    dark_onset_burst: 0 | 1 | 2 | 3;
    dark_irregularity: 0 | 1 | 2 | 3;
    midnight_fragmentation: 0 | 1 | 2 | 3;
    pre_light_decline: 0 | 1 | 2 | 3;
    pre_dark_anticipation: 0 | 1 | 2 | 3;
    notes: string;
    flags: string[];
    confidence: "low" | "med" | "high";
    meta: {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    };
}>;
export declare const analysisErrorSchema: z.ZodObject<{
    label: z.ZodString;
    error: z.ZodString;
    meta: z.ZodObject<{
        filename: z.ZodString;
        model: z.ZodString;
        aligned_to_dark: z.ZodBoolean;
        vcg_band: z.ZodEnum<["+-2SD", "+-1SD", "+-3SD"]>;
        run_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    }, {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    label: string;
    meta: {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    };
    error: string;
}, {
    label: string;
    meta: {
        filename: string;
        model: string;
        aligned_to_dark: boolean;
        vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
        run_id: string;
    };
    error: string;
}>;
export declare const analysisResponseSchema: z.ZodObject<{
    results: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        label: z.ZodString;
        baseline_light: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        dark_onset_burst: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        dark_irregularity: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        midnight_fragmentation: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        pre_light_decline: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        pre_dark_anticipation: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
        notes: z.ZodString;
        flags: z.ZodArray<z.ZodString, "many">;
        confidence: z.ZodEnum<["low", "med", "high"]>;
        meta: z.ZodObject<{
            filename: z.ZodString;
            model: z.ZodString;
            aligned_to_dark: z.ZodBoolean;
            vcg_band: z.ZodEnum<["+-2SD", "+-1SD", "+-3SD"]>;
            run_id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        }, {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        baseline_light: 0 | 1 | 2 | 3;
        dark_onset_burst: 0 | 1 | 2 | 3;
        dark_irregularity: 0 | 1 | 2 | 3;
        midnight_fragmentation: 0 | 1 | 2 | 3;
        pre_light_decline: 0 | 1 | 2 | 3;
        pre_dark_anticipation: 0 | 1 | 2 | 3;
        notes: string;
        flags: string[];
        confidence: "low" | "med" | "high";
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
    }, {
        label: string;
        baseline_light: 0 | 1 | 2 | 3;
        dark_onset_burst: 0 | 1 | 2 | 3;
        dark_irregularity: 0 | 1 | 2 | 3;
        midnight_fragmentation: 0 | 1 | 2 | 3;
        pre_light_decline: 0 | 1 | 2 | 3;
        pre_dark_anticipation: 0 | 1 | 2 | 3;
        notes: string;
        flags: string[];
        confidence: "low" | "med" | "high";
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
    }>, z.ZodObject<{
        label: z.ZodString;
        error: z.ZodString;
        meta: z.ZodObject<{
            filename: z.ZodString;
            model: z.ZodString;
            aligned_to_dark: z.ZodBoolean;
            vcg_band: z.ZodEnum<["+-2SD", "+-1SD", "+-3SD"]>;
            run_id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        }, {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
        error: string;
    }, {
        label: string;
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
        error: string;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    results: ({
        label: string;
        baseline_light: 0 | 1 | 2 | 3;
        dark_onset_burst: 0 | 1 | 2 | 3;
        dark_irregularity: 0 | 1 | 2 | 3;
        midnight_fragmentation: 0 | 1 | 2 | 3;
        pre_light_decline: 0 | 1 | 2 | 3;
        pre_dark_anticipation: 0 | 1 | 2 | 3;
        notes: string;
        flags: string[];
        confidence: "low" | "med" | "high";
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
    } | {
        label: string;
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
        error: string;
    })[];
}, {
    results: ({
        label: string;
        baseline_light: 0 | 1 | 2 | 3;
        dark_onset_burst: 0 | 1 | 2 | 3;
        dark_irregularity: 0 | 1 | 2 | 3;
        midnight_fragmentation: 0 | 1 | 2 | 3;
        pre_light_decline: 0 | 1 | 2 | 3;
        pre_dark_anticipation: 0 | 1 | 2 | 3;
        notes: string;
        flags: string[];
        confidence: "low" | "med" | "high";
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
    } | {
        label: string;
        meta: {
            filename: string;
            model: string;
            aligned_to_dark: boolean;
            vcg_band: "+-2SD" | "+-1SD" | "+-3SD";
            run_id: string;
        };
        error: string;
    })[];
}>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisError = z.infer<typeof analysisErrorSchema>;
export type AnalysisRow = AnalysisResult | AnalysisError;
export type VcgBand = z.infer<typeof resultMetaSchema>["vcg_band"];
//# sourceMappingURL=index.d.ts.map