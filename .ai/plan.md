# Debug: URL Content Extraction Issues

## 문제 1: X/Twitter URL에서 fxtwitter 실패 시 엉뚱한 콘텐츠 반환

### 원인
- `tryResolveInnerUrl`(fxtwitter API)이 실패하면 `null` 반환
- 이후 `tryArticleExtractor` → `tryRawFetch`가 **원래 x.com URL에 직접** 호출됨
- x.com은 JS 렌더링 페이지라 SSR HTML에 트렌딩/추천 등 **무관한 콘텐츠**가 포함
- 50자 이상 추출되면 성공으로 판단 → 엉뚱한 내용이 요약됨
- 정확한 트윗 텍스트를 반환할 수 있는 `tryOembed`까지 도달하지 못함

### 수정 방안
- `extract()` 메서드에서 소셜 미디어 URL(x.com, twitter.com)인 경우, `tryResolveInnerUrl` 실패 시 `tryArticleExtractor`/`tryRawFetch`를 건너뛰고 바로 `tryOembed`로 직행
- 구체적으로: `tryResolveInnerUrl` 호출 후, 소셜 미디어 URL이면 early return 분기 추가

### 수정 대상
- `src/extractor/extractor.service.ts`: `extract()` 메서드, `isSocialMediaUrl()` helper 추가
- `src/extractor/extractor.service.spec.ts`: fxtwitter 실패 시 oembed fallback 테스트 추가

---

## 문제 2: stripHtml에서 아티클 내부 링크(href) URL 소실

### 원인
- `stripHtml()`의 `/<[^>]+>/g` 정규식이 모든 HTML 태그를 제거
- `<a href="https://example.com">텍스트</a>` → `텍스트` (URL 정보 완전 소실)
- 아티클에 포함된 참조 링크, 출처 링크 등이 모두 사라짐

### 수정 방안
- `stripHtml()` 내에서 `<a>` 태그를 먼저 처리: `<a href="url">text</a>` → `text (url)` 형태로 변환
- 이후 나머지 태그는 기존대로 제거
- 동일 텍스트와 URL인 경우 (예: `<a href="https://x.com">https://x.com</a>`)는 URL만 남김 (중복 방지)

### 수정 대상
- `src/extractor/extractor.service.ts`: `stripHtml()` 메서드
- `src/extractor/extractor.service.spec.ts`: 링크 보존 테스트 추가
