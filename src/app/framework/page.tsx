import type { Metadata } from "next";
import { LAYER_LABEL, LAYER_QUESTION, PageHeader, Rows, Section } from "@/components/ui";
import { LAYERS, registry, type Layer, type ScoreWeights } from "@/lib/registry";

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

const SCORING: { dim: string; key: keyof ScoreWeights; q: string }[] = [
  { dim: "Novelty", key: "novelty", q: "Is this genuinely new, or an incremental step on known work?" },
  { dim: "Magnitude", key: "magnitude", q: "How large is the improvement over the previous best?" },
  { dim: "Evidence", key: "evidence", q: "How reproducible and independently verified is it?" },
  { dim: "Breadth", key: "breadth", q: "How many fields or problems does it affect?" },
  { dim: "Maturity", key: "maturity", q: "How close is it to working outside the lab?" },
];

export default function FrameworkPage() {
  const { scoreWeights, rank } = registry().config;
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

      <Section title="Scores and ranking" id="scores">
        <Rows>
          {SCORING.map((s) => (
            <div key={s.dim} className="grid grid-cols-[1fr_3rem] gap-3 py-2.5">
              <div>
                <div>{s.dim}</div>
                <div className="text-sm text-muted">{s.q}</div>
              </div>
              <span className="text-right tabular-nums text-faint">{Math.round(scoreWeights[s.key] * 100)}%</span>
            </div>
          ))}
        </Rows>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Claude reads each new item once (title plus abstract or excerpt) and scores each dimension 1–5. The
            weighted sum gives the quality score out of 100 shown next to each item. With only a title to go on, scores
            stay near the middle. The weights are a starting hypothesis, not a validated model.
          </p>
          <p>
            &ldquo;Top&rdquo; lists sort by rank: quality, plus {rank.perExtraSource} for each further source that
            reported the item (up to {rank.maxSourceBonus}), up to {rank.maxUpvoteBonus} for Hugging Face upvotes, and
            a small bonus or penalty for the source&apos;s priority. Items that are company news or otherwise off-topic
            lose {Math.abs(rank.notRelevant)} and are shown dimmed. Items not yet assessed rank at {rank.unassessed}.
          </p>
          <p>
            The same pass tags each item with topics from a fixed list and can move it to the domains its content is
            about, so a quantum paper from an AI lab is filed under quantum.
          </p>
        </div>
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
