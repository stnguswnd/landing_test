import Image from "next/image";
import { Section } from "@/components/layout/section";

export function Points() {
  return (
    <Section id="system" className="system-section">
      <div className="section-heading">
        <span className="tag">학생후기</span>
        <h2>아이의 표정이 달라질거에요!</h2>
        <h2>"영어공부가 재밌어요!"</h2>
      </div>

      <div className="story-grid">
        <article className="story-card story-card--letter">
          <div className="story-card__media">
            <Image
              src="/images/04.png"
              alt="학생 손편지 이미지"
              width={1200}
              height={1600}
              className="story-card__image is-letter"
            />
          </div>
          <div className="story-card__copy gaegu-regular system-letter">
            <p>To. 재인 선생님</p>
            <p>선생님 안녕하세요!</p>
            <p>저 Arina에요</p>
            <p>하고 싶지 않았던 이별을 하게 되었네요.</p>
            <p>저는 공부를 좋아하지 않았어요.</p>
            <p>
              그런데 선생님과 과외를 하면서 공부란 참 재밌는 거구나 느꼈어요.
            </p>
            <p>제가 발전할 수 있었던 것도 다 선생님 덕분이에요. 감사합니다.</p>
            <p>매일매일 칭찬해주시고</p>
            <p>제 수준을 높게 봐주시고 높게 만들어주셔서 감사합니다.</p>
            <p>이 말 밖에 할 말이 없네요.</p>
            <p>
              제가 다녔던 과외, 학원 그 어느 선생님중 가장 최고의
              선생님이셨어요.
            </p>
            <p>그 어떤 수업보다 재밌었고 최고였어요!</p>
            <p>
              최선을 다해서 친구들을 모아서 다시 선생님을 만날때까지 전 언제나
              노력할게요!
            </p>
            <p>Arina Sincerely</p>
          </div>
        </article>
      </div>
    </Section>
  );
}
