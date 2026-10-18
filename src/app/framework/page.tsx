import type { Metadata } from "next";
import { LAYER_LABEL, LAYER_QUESTION, PageHeader, Rows, Section } from "@/components/ui";
import { LAYERS, type Layer } from "@/lib/registry";

export const metadata: Metadata = { title: "Framework" };

const TIMELINE = [
  { year: "2012", signal: "AlexNet shows a major jump in image recognition", who: "ML researchers" },
  { year: "2017", signal: "“Attention Is All You Need” introduces the Transformer", who: "Researchers following NLP" },
  { year: "2018", signal: "GPT-1 demonstrates generative pretraining", who: "NLP specialists" },
  { year: "2020", signal: "GPT-3 demonstrates powerful few-shot learning", who: "AI researchers, early developers" },
  { year: "2022", signal: "ChatGPT launches", who: "General public" },
];

const EVIDENCE = [
  { stage: "Paper or preprint", shows: "The earliest public record. The result might not reproduce." },
  { stage: "Code, weights or data", shows: "Others can check it and build on it." },
  { stage: "Independent replication", shows: "A second group or third-party benchmark gets the same result." },
  { stage: "Release", shows: "It works well enough for people outside the lab to use." },
];

const SCORING = [
  { dim: "Novelty", q: "Is this genuinely new, or an incremental step on known work?", w: 25 },
  { dim: "Magnitude", q: "How large is the improvement over the previous best?", w: 25 },
  { dim: "Evidence", q: "How reproducible and independently verified is it?", w: 25 },
  { dim: "Breadth", q: "How many fields or problems does it affect?", w: 15 },
  { dim: "Maturity", q: "How close is it to working outside the lab?", w: 10 },
];

export default function FrameworkPage() {
  return (
    <>
      <PageHeader title="How to read the frontier">
        The goal is a high-quality overview of recent discoveries and developments: what became possible, how strong
        the evidence is, and how it builds on earlier work. Items come only from papers, labs and official release
        channels, never from general news or business coverage.
      </PageHeader>

      <Section title="Three layers">
        <Rows>
          {LAYERS.map((l, i) => (
            <div key={l} className="grid grid-cols-[1.5rem_7rem_1fr] gap-x-3 py-2.5 max-sm:grid-cols-[1.5rem_1fr]">
              <span className="font-mono text-sm text-faint">{i + 1}</span>
              <span>{LAYER_LABEL[l as Layer]}</span>
              <span className="text-muted max-sm:col-start-2">{LAYER_QUESTION[l as Layer]}</span>
            </div>
          ))}
        </Rows>
        <p className="mt-3 text-muted">
          Every item is tagged with the layer of the source that reported it. A busy scientific column with a quiet
          product column usually means results that haven&apos;t been built on yet.
        </p>
      </Section>

      <Section title="Who could have noticed modern AI?">
        <Rows>
          {TIMELINE.map((t) => (
            <div key={t.year} className="grid grid-cols-[3.5rem_1fr] gap-3 py-2.5">
              <span className="font-mono text-sm text-faint">{t.year}</span>
              <div>
                <div>{t.signal}</div>
                <div className="text-sm text-muted">{t.who}</div>
              </div>
            </div>
          ))}
        </Rows>
        <p className="mt-3 text-muted">
          The significant results were public years before they were obvious. Seeing them early means reading primary
          sources, not waiting for the coverage.
        </p>
      </Section>

      <Section title="From result to release">
        <Rows>
          {EVIDENCE.map((e, i) => (
            <div key={e.stage} className="grid grid-cols-[1.5rem_1fr] gap-3 py-2.5">
              <span className="font-mono text-sm text-faint">{i + 1}</span>
              <div>
                <div>{e.stage}</div>
                <div className="text-sm text-muted">{e.shows}</div>
              </div>
            </div>
          ))}
        </Rows>
        <p className="mt-3 text-muted">
          No single source covers all four stages. When an item is reported by several sources, it&apos;s merged, so
          a paper that also turns up in Hugging Face Daily Papers shows up as one item with several sources.
        </p>
      </Section>

      <Section title="Ranking developments">
        <Rows>
          {SCORING.map((s) => (
            <div key={s.dim} className="grid grid-cols-[1fr_3rem] gap-3 py-2.5">
              <div>
                <div>{s.dim}</div>
                <div className="text-sm text-muted">{s.q}</div>
              </div>
              <span className="text-right tabular-nums text-faint">{s.w}%</span>
            </div>
          ))}
        </Rows>
        <p className="mt-3 text-muted">
          Each dimension is scored 1–5, giving a score out of 100. The weights are a starting hypothesis, not a
          validated model. Scoring arrives in Phase 2.
        </p>
      </Section>

      <Section title="Finding what nobody is discussing yet">
        <div className="space-y-5">
          <div>
            <h3 className="font-medium">Track emerging researchers</h3>
            <p className="text-muted">
              Look for unusually influential work in small areas, repeated related results, and citations from
              independent groups.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Track acceleration, not size</h3>
            <p className="text-muted">
              Going from 40 to 160 papers a year (+300%) matters more than going from 5,000 to 6,000 (+20%). Check it
              against independent replication and a growing variety of research groups.
            </p>
          </div>
          <div>
            <h3 className="font-medium">Weigh claims by who checked them</h3>
            <p className="text-muted">
              A result repeated by a second group, a benchmark run by a third party, or open weights anyone can test
              outweighs a launch post. Labs describing their own work are reporting claims, not confirmations.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
