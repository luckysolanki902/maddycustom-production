import Image from "next/image";
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import styles from "./styles/custom-renderer.module.css";

const renderInlineStyles = (text) => {
  if (typeof text !== "string") return text;
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formattedText = formattedText.replace(/\*(.*?)\*/g, "<em>$1</em>");
  formattedText = formattedText.replace(/__(.*?)__/g, "<u>$1</u>");
  formattedText = formattedText.replace(/~~(.*?)~~/g, "<s>$1</s>");
  formattedText = formattedText.replace(/`(.*?)`/g, "<code>$1</code>");
  return formattedText;
};

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] }
};

const CustomRenderer = ({ data, seamlessImages = false }) => {
  const blocks = useMemo(() => (data && Array.isArray(data.blocks) ? data.blocks : []), [data]);
  // Preprocess for YouTube detection to avoid regex per render in map
  const processedBlocks = useMemo(() => blocks.map(b => {
    if (b.type === "paragraph") {
      const formattedText = renderInlineStyles(b.data?.text || "");
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
      const match = formattedText.match(youtubeRegex);
      return { ...b, formattedText, youtubeId: match ? match[1] : null };
    }
    return b;
  }), [blocks]);

  if (!processedBlocks.length) {
    return <p className={styles.rendererRoot}>No content available.</p>;
  }

  return (
    <div className={styles.rendererRoot}>
      {processedBlocks.map(block => {
        switch (block.type) {
          case "header": {
            const Tag = `h${block.data.level}`;
            return (
              <motion.div key={block.id} {...fadeUp} className={styles.animateBlock}>
                <Tag>{block.data.text}</Tag>
              </motion.div>
            );
          }
          case "paragraph": {
            if (block.youtubeId) {
              return (
                <motion.div key={block.id} {...fadeUp} className={`${styles.ytResponsive} ${styles.animateBlock}`}>
                  <iframe
                    src={`https://www.youtube.com/embed/${block.youtubeId}`}
                    allowFullScreen
                    title="Product video"
                  />
                </motion.div>
              );
            }
            return (
              <motion.p
                key={block.id}
                {...fadeUp}
                className={styles.animateBlock}
                dangerouslySetInnerHTML={{ __html: block.formattedText }}
              />
            );
          }
          case "list": {
            const isUnordered = block.data.style === "unordered";
            const ListTag = isUnordered ? "ul" : "ol";
            return (
              <motion.div key={block.id} {...fadeUp} className={styles.animateBlock}>
                <ListTag>
                  {block.data.items.map((item, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: item.content }} />
                  ))}
                </ListTag>
              </motion.div>
            );
          }
          case "image": {
            const { file, caption } = block.data;
            return (
              <motion.figure
                key={block.id}
                {...fadeUp}
                className={`${styles.imageWrap} ${seamlessImages ? styles.seamless : ""} ${styles.animateBlock}`}
              >
                <Image
                  width={1200}
                  height={1200}
                  src={file.url}
                  alt={caption || "Uploaded image"}
                  className={styles.imageElement}
                />
                {caption && (
                  <figcaption className={`${styles.caption} ${seamlessImages ? styles.seamlessCaption : ""}`}>{caption}</figcaption>
                )}
              </motion.figure>
            );
          }
          default:
            return (
              <motion.p key={block.id} {...fadeUp} className={styles.animateBlock}>
                Unsupported block type: <strong>{block.type}</strong>
              </motion.p>
            );
        }
      })}
    </div>
  );
};

export default CustomRenderer;
