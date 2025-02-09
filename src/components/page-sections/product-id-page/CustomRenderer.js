import React from "react";
// import DOMPurify from "dompurify";

// Helper function to apply inline formatting.
const renderInlineStyles = (text) => {
  if (typeof text !== "string") return text;
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formattedText = formattedText.replace(/\*(.*?)\*/g, "<em>$1</em>");
  formattedText = formattedText.replace(/__(.*?)__/g, "<u>$1</u>");
  formattedText = formattedText.replace(/~~(.*?)~~/g, "<s>$1</s>");
  formattedText = formattedText.replace(/`(.*?)`/g, "<code>$1</code>");
  // Optionally, sanitize the output to prevent XSS.
  // formattedText = DOMPurify.sanitize(formattedText);
  return formattedText;
};

const CustomRenderer = ({ data }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || "";

  if (!data || !data.blocks) {
    return <p>No content available.</p>;
  }

  return (
    <div className="custom-renderer">
      {data.blocks.map((block) => {
        switch (block.type) {
          case "header": {
            const Tag = `h${block.data.level}`;
            return <Tag key={block.id}>{block.data.text}</Tag>;
          }
          case "paragraph": {
            const formattedText = renderInlineStyles(block.data.text);
            // Detect YouTube links and render as a responsive iframe.
            const youtubeRegex =
              /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
            const match = formattedText.match(youtubeRegex);
            if (match) {
              const videoId = match[1];
              return (
                <div key={block.id} className="youtube-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    frameBorder="0"
                    allowFullScreen
                  />
                </div>
              );
            } else {
              return (
                <p
                  key={block.id}
                  dangerouslySetInnerHTML={{ __html: formattedText }}
                ></p>
              );
            }
          }
          case "list": {
            if (block.data.style === "unordered") {
              return (
                <ul key={block.id}>
                  {block.data.items.map((item, index) => (
                    <li
                      key={index}
                      dangerouslySetInnerHTML={{ __html: item.content }}
                    />
                  ))}
                </ul>
              );
            } else {
              return (
                <ol key={block.id}>
                  {block.data.items.map((item, index) => (
                    <li
                      key={index}
                      dangerouslySetInnerHTML={{ __html: item.content }}
                    />
                  ))}
                </ol>
              );
            }
          }
          case "image": {
            const { file, caption, stretched } = block.data;
            return (
              <div key={block.id} className="image-container">
                <img
                  src={`${baseImageUrl}${file.url.split(".com")[1]}`}
                  alt={caption || "Uploaded image"}
                  className={stretched ? "stretched" : ""}
                />
                {caption && <p className="caption">{caption}</p>}
              </div>
            );
          }
          default:
            return (
              <p key={block.id}>
                Unsupported block type: <strong>{block.type}</strong>
              </p>
            );
        }
      })}

      <style jsx>{`
        .custom-renderer {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          padding: 0 1rem;
        }
        h1 {
          font-size: 2em;
          margin: 1em 0 0.5em;
          color: #2c3e50;
        }
        h2 {
          font-size: 1.75em;
          margin: 1em 0 0.5em;
          color: #34495e;
        }
        h3 {
          font-size: 1.5em;
          margin: 1em 0 0.5em;
          color: #7f8c8d;
        }
        p {
          margin: 0.5em 0;
        }
        ul {
          list-style-type: disc;
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        ol {
          list-style-type: decimal;
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        li {
          margin: 0.25em 0;
        }
        strong {
          font-weight: bold;
          color: #e74c3c;
        }
        em {
          font-style: italic;
          color: #8e44ad;
        }
        u {
          text-decoration: underline;
          color: #2980b9;
        }
        s {
          text-decoration: line-through;
          color: #95a5a6;
        }
        code {
          background-color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
        }
        .youtube-video {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          margin: 1em 0;
        }
        .youtube-video iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .image-container {
          margin: 1em 0;
          text-align: center;
        }
        .image-container img {
          width: 100%;
          height: auto;
          max-width: 100%;
          border-radius: 8px;
          object-fit: cover;
        }
        .caption {
          font-size: 0.9em;
          color: #666;
          margin-top: 0.5em;
        }
        @media (max-width: 600px) {
          .custom-renderer {
            padding: 0 10px;
          }
          h1 {
            font-size: 1.5em;
          }
          h2 {
            font-size: 1.25em;
          }
          h3 {
            font-size: 1em;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomRenderer;
