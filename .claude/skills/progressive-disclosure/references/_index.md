# Progressive Disclosure References

> 각 레퍼런스 파일의 인덱스 및 Impact 레벨 정의

---

## Impact 레벨 정의

| 레벨 | 의미 | 무시 시 결과 |
|------|------|-------------|
| **CRITICAL** | 필수 | 기능 작동 안함, 로드 실패 |
| **HIGH** | 강력 권장 | 성능/품질 저하, 오작동 가능 |
| **MEDIUM** | 권장 | 유지보수 어려움 |
| **LOW** | 선택 | 일관성 저하 |

---

## 파일 인덱스

| 파일 | 대상 | 핵심 Impact 항목 |
|------|------|-----------------|
| [skills.md](skills.md) | Skill 작성 | CRITICAL: name, description |
| [agents.md](agents.md) | Agent 작성 | CRITICAL: name, description, tools |
| [prompts.md](prompts.md) | 프롬프트 설계 | HIGH: 역할 정의, 지침 구조화 |

---

## Impact 레벨 사용법

각 레퍼런스 파일에서 중요 항목은 다음 형식으로 표시됩니다:

```markdown
### [CRITICAL] 항목명

**Incorrect:**
```yaml
# 잘못된 예시
```

**Correct:**
```yaml
# 올바른 예시
```
```

이 형식을 통해:
1. 중요도를 즉시 파악
2. 잘못된 패턴 회피
3. 올바른 패턴 학습
