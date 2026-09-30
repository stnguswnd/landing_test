"use client";

import { useEffect, useMemo, useState } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics";

type ReviewImage = {
  src: string;
  alt: string;
  layoutPosition: number;
  heightRatio: number;
  isOriginalReplacement: boolean;
};

type StudentReviewGalleryProps = {
  images: ReviewImage[];
};

export function StudentReviewGallery({ images }: StudentReviewGalleryProps) {
  const [columnCount, setColumnCount] = useState(3);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateColumnCount = () => setColumnCount(mediaQuery.matches ? 2 : 3);

    updateColumnCount();
    mediaQuery.addEventListener("change", updateColumnCount);
    return () => mediaQuery.removeEventListener("change", updateColumnCount);
  }, []);

  useEffect(() => {
    if (selectedIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        trackAnalyticsEvent("review_modal_close", {
          review_index: selectedIndex + 1,
          close_method: "keyboard",
        });
        setSelectedIndex(null);
      }
      if (event.key === "ArrowLeft") {
        const nextIndex = (selectedIndex - 1 + images.length) % images.length;
        trackAnalyticsEvent("review_image_navigate", {
          direction: "previous",
          navigation_method: "keyboard",
          review_index: nextIndex + 1,
        });
        setSelectedIndex(nextIndex);
      }
      if (event.key === "ArrowRight") {
        const nextIndex = (selectedIndex + 1) % images.length;
        trackAnalyticsEvent("review_image_navigate", {
          direction: "next",
          navigation_method: "keyboard",
          review_index: nextIndex + 1,
        });
        setSelectedIndex(nextIndex);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [images.length, selectedIndex]);

  const collapsedImageCount = columnCount * 3;
  const hasMoreImages = images.length > collapsedImageCount;
  const visibleImages = images;

  const columns = useMemo(() => {
    const nextColumns = Array.from({ length: columnCount }, () => [] as Array<ReviewImage & { originalIndex: number }>);
    const columnHeights = Array.from({ length: columnCount }, () => 0);

    visibleImages.forEach((image) => {
      const originalIndex = images.findIndex((candidate) => candidate.src === image.src);
      const columnIndex = columnCount === 2 && image.isOriginalReplacement
        ? columnHeights.indexOf(Math.min(...columnHeights))
        : (image.layoutPosition - 1) % columnCount;

      nextColumns[columnIndex].push({ ...image, originalIndex });
      columnHeights[columnIndex] += image.heightRatio + 0.06;
    });

    return nextColumns;
  }, [columnCount, images, visibleImages]);

  if (images.length === 0) {
    return (
      <div className="student-reviews__empty" role="status">
        후기 이미지를 준비 중입니다.
      </div>
    );
  }

  const selectedImage = selectedIndex === null ? null : images[selectedIndex];

  function openReviewImage(index: number) {
    trackAnalyticsEvent("review_image_open", {
      review_index: index + 1,
      image_file: images[index]?.src.split("/").pop(),
    });
    setSelectedIndex(index);
  }

  function closeReviewModal(method: "button" | "backdrop") {
    if (selectedIndex !== null) {
      trackAnalyticsEvent("review_modal_close", {
        review_index: selectedIndex + 1,
        close_method: method,
      });
    }
    setSelectedIndex(null);
  }

  function showPreviousImage() {
    if (selectedIndex === null) return;
    const nextIndex = (selectedIndex - 1 + images.length) % images.length;
    trackAnalyticsEvent("review_image_navigate", {
      direction: "previous",
      navigation_method: "button",
      review_index: nextIndex + 1,
    });
    setSelectedIndex(nextIndex);
  }

  function showNextImage() {
    if (selectedIndex === null) return;
    const nextIndex = (selectedIndex + 1) % images.length;
    trackAnalyticsEvent("review_image_navigate", {
      direction: "next",
      navigation_method: "button",
      review_index: nextIndex + 1,
    });
    setSelectedIndex(nextIndex);
  }

  return (
    <>
      <div className={`student-reviews__gallery-shell ${hasMoreImages && !isExpanded ? "is-collapsed" : ""}`}>
        <div className="student-reviews__grid">
          {columns.map((column, columnIndex) => (
            <div className="student-reviews__column" key={`review-column-${columnIndex}`}>
              {column.map((image) => (
                <button
                  className="student-reviews__item"
                  type="button"
                  key={image.src}
                  onClick={() => openReviewImage(image.originalIndex)}
                  data-analytics-tracked="true"
                  data-review-index={image.originalIndex + 1}
                  data-review-image={image.src.split("/").pop()}
                  aria-label={`${image.alt} 크게 보기`}
                >
                  <img
                    className="student-reviews__image"
                    src={image.src}
                    alt={image.alt}
                    loading={image.originalIndex < columnCount ? "eager" : "lazy"}
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          ))}
        </div>

        {hasMoreImages && !isExpanded ? (
          <div className="student-reviews__more-layer">
            <button
              className="student-reviews__more-button"
              type="button"
              data-analytics-tracked="true"
              onClick={() => {
                trackAnalyticsEvent("review_gallery_expand", { image_count: images.length });
                setIsExpanded(true);
              }}
            >
              후기 더 보기 <span aria-hidden="true">+</span>
            </button>
          </div>
        ) : null}
      </div>

      {selectedImage ? (
        <div
          className="review-modal"
          role="dialog"
          aria-modal="true"
          aria-label="학생 후기 이미지 확대 보기"
          onClick={() => closeReviewModal("backdrop")}
        >
          <button
            className="review-modal__close"
            type="button"
            data-analytics-tracked="true"
            onClick={() => closeReviewModal("button")}
            aria-label="확대 화면 닫기"
            autoFocus
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>

          <button
            className="review-modal__nav review-modal__nav--previous"
            type="button"
            data-analytics-tracked="true"
            onClick={(event) => {
              event.stopPropagation();
              showPreviousImage();
            }}
            aria-label="이전 후기 보기"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="review-modal__content" onClick={(event) => event.stopPropagation()}>
            <img className="review-modal__image" src={selectedImage.src} alt={selectedImage.alt} />
            <span className="review-modal__counter">
              {(selectedIndex ?? 0) + 1} / {images.length}
            </span>
          </div>

          <button
            className="review-modal__nav review-modal__nav--next"
            type="button"
            data-analytics-tracked="true"
            onClick={(event) => {
              event.stopPropagation();
              showNextImage();
            }}
            aria-label="다음 후기 보기"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      ) : null}
    </>
  );
}
