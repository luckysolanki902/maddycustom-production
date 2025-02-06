
import React from "react";
// import DOMPurify from "dompurify";

// Helper function to handle inline styles
const renderInlineStyles = (text) => {
  // Replace **bold** with <strong>
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Replace *italic* with <em>
  formattedText = formattedText.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Replace __underline__ with <u>
  formattedText = formattedText.replace(/__(.*?)__/g, "<u>$1</u>");
  // Replace ~~strikethrough~~ with <s>
  formattedText = formattedText.replace(/~~(.*?)~~/g, "<s>$1</s>");
  // Replace `code` with <code>
  formattedText = formattedText.replace(/`(.*?)`/g, "<code>$1</code>");

  // Sanitize the formatted text to prevent XSS attacks
  // formattedText = DOMPurify.sanitize(formattedText);

  return formattedText;
};

const CustomRenderer = ({ data }) => {
  const baseImageUrl=process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL

  console.log(data,"loooo")
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
            const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^&\s]+)/;
            const match = formattedText.match(youtubeRegex);
            if (match) {
              const videoId = match[1];
              return (
                <div key={block.id} className="youtube-video">
                  <iframe
                    width="100%"
                    height="300"
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

          case "list":
          if(block.data.style==="unordered"){
            return (
              <ul key={block.id}>
              {block.data.items.map((item, index) => (
              <li key={index} dangerouslySetInnerHTML={{ __html: item.content }}>
                {/* <span dangerouslySetInnerHTML={{ __html: item.content }}></span> */}
              </li>
            ))}
              </ul>
            )
          }
          else{
            return (
              <ol key={block.id} >
              {block.data.items.map((item, index) => (
              <li key={index} dangerouslySetInnerHTML={{ __html: item.content }}>
                {/* <span dangerouslySetInnerHTML={{ __html: item.content }}></span> */}
              </li>
            ))}
              </ol>
            )
          }

        
          case "image": {
            const { file, caption, stretched } = block.data;
            console.log(file.url.split(".com")[1])
            return (
              <div key={block.id} className="image-container">
                <img
                  style={{ width:"200px", height:"200px" }}
                  src={`${baseImageUrl}${file.url.split(".com")[1]}`}
                  alt={caption || "Uploaded image"}
                  className={stretched ? "stretched" : ""}
                />
                {caption && <p className="caption">{caption}</p>}
              </div>
            );
          }

          // Add more block types as needed

          default:
            return (
              <p key={block.id}>
                Unsupported block type: <strong>{block.type}</strong>
              </p>
            );
        }
      })}

      {/* Scoped CSS for styling */}
      <style jsx>{`
        .custom-renderer {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
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
  list-style-type: disc; /* Ensures bullets for unordered lists */
  margin: 0.5em 0;
  padding-left: 1.5em;
}

ol {
  list-style-type: decimal; /* Ensures numbers for ordered lists */
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

        /* Additional styles for responsiveness */
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
