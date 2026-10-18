import { z } from "zod";
import { excerpt, parseDate } from "@/lib/text";
import { defineConnector, type NormalizedItem } from "./types";

const config = z.object({
  lookbackDays: z.number().int().positive().default(7),
  phases: z.array(z.string()).default(["PHASE1", "PHASE2", "PHASE3"]),
  pageSize: z.number().int().positive().max(100).default(50),
  queries: z
    .array(z.object({ label: z.string(), term: z.string(), domains: z.array(z.string()).optional() }))
    .min(1),
});

const study = z.object({
  protocolSection: z.object({
    identificationModule: z.object({ nctId: z.string(), briefTitle: z.string() }),
    statusModule: z
      .object({
        overallStatus: z.string().optional(),
        studyFirstPostDateStruct: z.object({ date: z.string() }).optional(),
        lastUpdatePostDateStruct: z.object({ date: z.string() }).optional(),
      })
      .optional(),
    sponsorCollaboratorsModule: z.object({ leadSponsor: z.object({ name: z.string() }).optional() }).optional(),
    descriptionModule: z.object({ briefSummary: z.string().optional() }).optional(),
    designModule: z.object({ phases: z.array(z.string()).optional() }).optional(),
  }),
});
const response = z.object({ studies: z.array(study) });

const FIELDS = [
  "NCTId",
  "BriefTitle",
  "Phase",
  "OverallStatus",
  "LastUpdatePostDate",
  "StudyFirstPostDate",
  "LeadSponsorName",
  "BriefSummary",
].join(",");

export const ctgovConnector = defineConnector({
  method: "ctgov",
  configSchema: config,
  async fetch({ config, http, now }) {
    const since = new Date(now.getTime() - config.lookbackDays * 86_400_000).toISOString().slice(0, 10);
    const advanced = `AREA[Phase](${config.phases.join(" OR ")}) AND AREA[LastUpdatePostDate]RANGE[${since},MAX]`;
    const items: NormalizedItem[] = [];

    for (const q of config.queries) {
      const params = new URLSearchParams({
        "query.term": q.term,
        "filter.advanced": advanced,
        sort: "LastUpdatePostDate:desc",
        pageSize: String(config.pageSize),
        fields: FIELDS,
      });
      const res = await http.get(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
        accept: "application/json",
      });
      for (const { protocolSection: p } of response.parse(JSON.parse(res.text)).studies) {
        const id = p.identificationModule.nctId;
        const phases = p.designModule?.phases?.join("/") ?? "";
        const status = p.statusModule?.overallStatus?.replaceAll("_", " ").toLowerCase();
        const sponsor = p.sponsorCollaboratorsModule?.leadSponsor?.name;
        const meta = [phases, status, sponsor].filter(Boolean).join(" · ");
        const summary = p.descriptionModule?.briefSummary;
        items.push({
          url: `https://clinicaltrials.gov/study/${id}`,
          externalKind: "nct",
          externalId: id,
          title: p.identificationModule.briefTitle,
          authors: sponsor ? [sponsor] : undefined,
          publishedAt: parseDate(
            p.statusModule?.lastUpdatePostDateStruct?.date ?? p.statusModule?.studyFirstPostDateStruct?.date,
          ),
          excerpt: excerpt([meta, summary].filter(Boolean).join(" — ")),
          abstract: summary,
          domains: q.domains,
        });
      }
    }
    return { items };
  },
});
