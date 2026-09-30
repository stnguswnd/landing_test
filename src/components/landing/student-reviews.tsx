import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { StudentReviewGallery } from "@/components/landing/student-review-gallery";
import { Section } from "@/components/layout/section";

const reviewDirectory = path.join(process.cwd(), "public", "images", "reviews");
const supportedImageExtensions = /\.(avif|gif|jpe?g|png|webp)$/i;
const imageRatioCache = new Map<string, number>();

function getImageHeightRatio(filePath: string) {
  const cachedRatio = imageRatioCache.get(filePath);
  if (cachedRatio) return cachedRatio;

  try {
    const bytes = readFileSync(filePath);

    if (bytes.subarray(1, 4).toString("ascii") === "PNG" && bytes.length >= 24) {
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      const ratio = height / width;
      imageRatioCache.set(filePath, ratio);
      return ratio;
    }

    if (bytes.subarray(0, 3).toString("ascii") === "GIF" && bytes.length >= 10) {
      const width = bytes.readUInt16LE(6);
      const height = bytes.readUInt16LE(8);
      const ratio = height / width;
      imageRatioCache.set(filePath, ratio);
      return ratio;
    }

    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

      while (offset + 8 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }

        const marker = bytes[offset + 1];
        if (startOfFrameMarkers.has(marker)) {
          const height = bytes.readUInt16BE(offset + 5);
          const width = bytes.readUInt16BE(offset + 7);
          const ratio = height / width;
          imageRatioCache.set(filePath, ratio);
          return ratio;
        }

        const segmentLength = bytes.readUInt16BE(offset + 2);
        if (segmentLength < 2) break;
        offset += segmentLength + 2;
      }
    }
  } catch {
    // If metadata cannot be read, the gallery uses a neutral estimate.
  }

  imageRatioCache.set(filePath, 1);
  return 1;
}

function getReviewImages() {
  if (!existsSync(reviewDirectory)) return [];

  const fileNames = readdirSync(reviewDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && supportedImageExtensions.test(entry.name))
    .map((entry) => entry.name);
  const replacementPositions = new Set(
    fileNames
      .map((fileName) => fileName.match(/^new[_ -]?(\d+)/i)?.[1])
      .filter((position): position is string => Boolean(position))
      .map(Number),
  );

  return fileNames
    .map((fileName) => {
      const newImageMatch = fileName.match(/^new[_ -]?(\d+)/i);
      const numberedImageMatch = fileName.match(/^(\d+)/);
      const layoutPosition = Number(newImageMatch?.[1] ?? numberedImageMatch?.[1] ?? Number.MAX_SAFE_INTEGER);
      const isOriginalWithReplacement = Boolean(numberedImageMatch && replacementPositions.has(layoutPosition));

      return {
        fileName,
        layoutPosition,
        isOriginalWithReplacement,
        sortPosition: isOriginalWithReplacement ? layoutPosition + 1.5 : layoutPosition,
      };
    })
    .sort((a, b) => {
      if (a.sortPosition !== b.sortPosition) return a.sortPosition - b.sortPosition;
      return a.fileName.localeCompare(b.fileName, "ko", { numeric: true, sensitivity: "base" });
    })
    .map((image, index) => ({
      src: `/images/reviews/${encodeURIComponent(image.fileName)}`,
      alt: `학생 및 학부모 후기 ${index + 1}`,
      layoutPosition: image.layoutPosition,
      heightRatio: getImageHeightRatio(path.join(reviewDirectory, image.fileName)),
      isOriginalReplacement: image.isOriginalWithReplacement,
    }));
}

export function StudentReviews() {
  const reviewImages = getReviewImages();

  return (
    <Section id="system" className="student-reviews">
      <div className="student-reviews__heading">
        <span className="student-reviews__tag">학생후기</span>
        <h2>
          <span>“울면서 공부했는데, 지금은 너무 재밌다고 해요”</span>
          <span>“중학교부터는 영어학원 안다녔어요”</span>
        </h2>
        <p>2026년도 학생들과 학부모들의 생생한 후기</p>
      </div>

      <StudentReviewGallery images={reviewImages} />
    </Section>
  );
}
