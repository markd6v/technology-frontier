import type { Metadata } from "next";
import { Card, LayerBadge, LAYER_QUESTION, PageHeader, Section } from "@/components/ui";
import { LAYERS } from "@/lib/registry";

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
      <PageHeader title="How to read the frontier" kicker="Framework">
        The goal is to spot developments early enough to experiment, and to tell real commercial opportunities
        apart from impressive technical dead ends. The system answers four questions: what is advancing, where
        breakthroughs first show up, when they become commercially useful, and who sees the implications first.
      </PageHeader>

      <Section title="Four layers">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((l, i) => (
            <Card key={l} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <LayerBadge layer={l} />
                <span className="text-xs text-faint">Layer {i + 1}</span>
              </div>
              <p className="text-sm">{LAYER_QUESTION[l]}</p>
            </Card>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          The best opportunities often show up when layers 1 and 2 are moving fast and layers 3 and 4 haven&apos;t
          caught up yet. Every item in the feed is tagged with the layer of the source that reported it.
        </p>
      </Section>

      <Section title="Three inflections">
        <div className="grid gap-3 md:grid-cols-3">
          {STAGES.map((s) => (
            <Card key={s.n} className={`p-4 ${s.n === 2 ? "border-accent" : ""}`}>
              <div className="text-xs text-faint">Stage {s.n}</div>
              <h3 className="font-semibold">{s.name}</h3>
              <p className="mt-1 text-sm">{s.notice}</p>
              <p className="mt-2 text-xs text-muted">e.g. {s.example}</p>
              <p className={`mt-2 text-xs font-medium ${s.n === 2 ? "text-accent" : "text-faint"}`}>{s.where}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Who could have noticed modern AI?">
          <Card className="divide-y divide-line">
            {TIMELINE.map((t) => (
              <div key={t.year} className="grid grid-cols-[52px_1fr] gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-faint">{t.year}</span>
                <div>
                  <div>{t.signal}</div>
                  <div className="text-xs text-muted">{t.who}</div>
                </div>
              </div>
            ))}
          </Card>
          <p className="mt-3 text-sm text-muted">
            The gap between 2017 and 2022 was five years. But recognizing the Transformer in 2017 didn&apos;t mean
            predicting ChatGPT, or knowing which companies would capture the value.
          </p>
        </Section>

        <Section title="Discovery vs. confirmation">
          <Card className="divide-y divide-line">
            {EVIDENCE.map((e, i) => (
              <div key={e.stage} className="grid grid-cols-[24px_1fr] gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono text-faint">{i + 1}</span>
                <div>
                  <div className="font-medium">{e.stage}</div>
                  <div className="text-muted">{e.shows}</div>
                </div>
              </div>
            ))}
          </Card>
          <p className="mt-3 text-sm text-muted">
            No single source covers all four stages. When an item is reported by several sources, it&apos;s
            merged, so a paper that later turns up on Hacker News or in a repo shows up as one item with several
            sources.
          </p>
        </Section>
      </div>

      <Section title="Ranking breakthroughs">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="px-4 py-2 font-medium">Dimension</th>
                <th className="px-2 py-2 font-medium">Question</th>
                <th className="px-4 py-2 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SCORING.map((s) => (
                <tr key={s.dim}>
                  <td className="px-4 py-2 font-medium">{s.dim}</td>
                  <td className="px-2 py-2 text-muted">{s.q}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.w}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Each dimension is scored 1–5, giving a score out of 100. The weights are a starting hypothesis, not a
          validated model. Scientific significance and entrepreneurial opportunity are ranked separately and never
          merged: a quantum breakthrough can be extraordinary science with little near-term opportunity, and a
          modest drop in inference cost can open an enormous software market. Scoring arrives in Phase 2.
        </p>
      </Section>

      <Section title="Finding what nobody is discussing yet">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <h3 className="font-semibold">Track emerging researchers</h3>
            <p className="mt-1 text-sm text-muted">
              Look for unusually influential work in small areas, repeated related breakthroughs, citations from
              independent groups, and moves from academia into startups.
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold">Track acceleration, not size</h3>
            <p className="mt-1 text-sm text-muted">
              Going from 40 to 160 papers a year (+300%) matters more than going from 5,000 to 6,000 (+20%). Check
              it against independent replication and a growing variety of research groups.
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold">Look for expert/market disagreement</h3>
            <p className="mt-1 text-sm text-muted">
              Researchers and early users are enthusiastic while investors stay skeptical, or the reverse. Both
              point to where technical reality and expectations diverge.
            </p>
          </Card>
        </div>
      </Section>
    </>
  );
}
