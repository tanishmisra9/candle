/**
 * A paper's abstract with its structure kept. PubMed abstracts arrive as sections separated by blank lines ("BACKGROUND: …
 * \n\nMETHODS: …"; 208 of the 395 stored abstracts do), which a single <p> collapsed into one 2,000-character block with no
 * way to find Results or Conclusions. Each blank-line block is a paragraph and a leading ALL-CAPS label is bold. Labels
 * written in mixed case inline ("Materials and Methods:") carry no line break to split on, so they stay as plain text.
 */
const LABEL = /^([A-Z][A-Z &/,-]{2,40}):\s*/;

export function AbstractText({ text, className }: { text: string; className?: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const label = LABEL.exec(block);
        return (
          // whitespace-pre-line: a single newline inside a block (a list, a sub-heading) is kept too.
          <p key={index} className="whitespace-pre-line [&:not(:first-child)]:mt-3">
            {label ? (
              <>
                <strong className="font-semibold">{label[1]}:</strong> {block.slice(label[0].length)}
              </>
            ) : (
              block
            )}
          </p>
        );
      })}
    </div>
  );
}
