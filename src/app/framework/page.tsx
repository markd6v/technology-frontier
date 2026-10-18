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
  { year: "2023", signal: "Generative AI becomes a mainstream investment theme", who: "Almost everyone" },
];

const EVIDENCE = [
  { stage: "Paper", shows: "Earliest public signal. The result might not reproduce." },
  { stage: "Working repository", shows: "Stronger evidence that it's technically feasible." },
  { stage: "Product release", shows: "Someone believes it's ready for practical use." },
  { stage: "Customer adoption", shows: "Evidence that it actually creates value." },
];

const STAGES = [
  { n: 1, name: "Technical inflection", notice: "A previously difficult capability becomes possible", example: "Transformer architecture, 2017", where: "Scientific publications" },
  { n: 2, name: "Economic inflection", notice: "It becomes affordable and reliable enough to use", example: "Rapid gains in language-model capability and deployment", where: "Where this system concentrates" },
  { n: 3, name: "Adoption inflection", notice: "Customers begin changing their behaviour", example: "ChatGPT and the wave of AI applications after it", where: "Most technology news" },
];

const SCORING = [
  { dim: "Magnitude", q: "How much does it improve something important?", w: 20 },
  { dim: "Evidence", q: "How reproducible and independently verified is it?", w: 20 },
  { dim: "Economic impact", q: "Does it significantly change the economics of an activity?", w: 20 },
  { dim: "Adoption", q: "Are sophisticated users starting to adopt it?", w: 15 },
  { dim: "Timing", q: "Is there an opportunity to build something now?", w: 15 },
  { dim: "Competitive gap", q: "Is the opportunity still underexplored?", w: 10 },
];

export default function FrameworkPage() {
  return (
    <>
      <PageHeader title="How to read the frontier">
        The goal is to spot developments early enough to experiment, and to tell real commercial opportunities
        apart from impressive technical dead ends. The system answers four questions: what is advancing, where
        breakthroughs first show up, when they become commercially useful, and who sees the implications first.
      </PageHeader>

      <Section title="Four layers">
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
          The best opportunities often show up when layers 1 and 2 are moving fast and layers 3 and 4 haven&apos;t
          caught up yet. That is what the home page shows. Every item is tagged with the layer of the source that
          reported it.
        </p>
      </Section>

      <Section title="Three inflections">
        <Rows>
          {STAGES.map((s) => (
            <div key={s.n} className={`py-3 ${s.n === 2 ? "border-l-2 border-accent pl-4" : ""}`}>
              <div className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="mr-3 font-mono text-sm text-faint">{s.n}</span>
                  {s.name}
                </span>
                <span className={`shrink-0 text-sm ${s.n === 2 ? "text-accent" : "text-faint"}`}>{s.where}</span>
              </div>
              <p className="text-sm text-muted">
                {s.notice}. For example: {s.example}.
              </p>
            </div>
          ))}
        </Rows>
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
          The gap between 2017 and 2022 was five years. But recognizing the Transformer in 2017 didn&apos;t mean
          predicting ChatGPT, or knowing which companies would capture the value.
        </p>
      </Section>

      <Section title="Discovery vs. confirmation">
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
          a paper that later turns up on Hacker News or in a repo shows up as one item with several sources.
        </p>
      </Section>

      <Section title="Ranking breakthroughs">
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
          validated model. Scientific significance and entrepreneurial opportunity are ranked separately and never
          merged: a quantum breakthrough can be extraordinary science with little near-term opportunity, and a
          modest drop in inference cost can open an enormous software market. Scoring arrives in Phase 2.
        </p>
      </Section>

      <Section title="Finding what nobody is discussing yet">
        <div className="space-y-5">
          <div>
            <h3 className="font-medium">Track emerging researchers</h3>
            <p className="text-muted">
              Look for unusually influential work in small areas, repeated related breakthroughs, citations from
              independent groups, and moves from academia into startups.
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
            <h3 className="font-medium">Look for expert/market disagreement</h3>
            <p className="text-muted">
              Researchers and early users are enthusiastic while investors stay skeptical, or the reverse. Both point
              to where technical reality and expectations diverge.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
