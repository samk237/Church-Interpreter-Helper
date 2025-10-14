# Theological Dictionary Update

## Changes Made

### 1. Enhanced Server-Side Ollama Prompt

The translation prompt in `server.js` has been significantly improved to include:

- Specialized theological terminology reference list
- Context-aware instructions for church/theological terms
- Specific examples of common theological concepts including:
  - 귀복주의/번영신학 → prosperity gospel
  - 성령 → Holy Spirit
  - 구원 → salvation
  - 속죄 → redemption/atonement
  - 칭의 → justification
  - And many more...

### 2. Expanded Client-Side Dictionary

The `BASE_DICTIONARY` in `app.js` has been expanded from ~23 terms to **130+ theological terms**, including:

#### Controversial/Specific Theological Concepts

- 귀복주의 = prosperity gospel
- 번영신학 = prosperity theology
- 기복신앙 = prosperity faith
- 율법주의 = legalism
- 은사주의 = charismatic movement
- 근본주의 = fundamentalism
- 자유주의 = liberalism
- 복음주의 = evangelicalism

#### Core Theological Terms

- Trinity (삼위일체)
- Salvation concepts (구원, 칭의, 성화, 속죄)
- Sacraments (세례, 성찬식)
- End times terms (재림, 종말, 부활)

#### Church Roles

- 목사 = pastor
- 장로 = elder
- 집사 = deacon
- 권사 = deaconess
- 전도사 = evangelist
- 선교사 = missionary

#### Prayer Types

- 중보기도 = intercession
- 통성기도 = corporate prayer
- 침묵기도 = silent prayer

## How It Works

### Translation Flow

1. **Local Dictionary First**: The app first checks the expanded BASE_DICTIONARY for exact matches
2. **Ollama with Enhanced Prompt**: If not found locally, Ollama receives a theologically-informed prompt
3. **Fallback**: If Ollama fails, LibreTranslate is used as backup

### Benefits

- **Faster**: Common theological terms are translated instantly from the local dictionary
- **More Accurate**: Specialized terms like "귀복주의" will now correctly translate to "prosperity gospel"
- **Context-Aware**: The Ollama prompt now understands church/theological context
- **Persistent**: Successfully translated terms are stored in the session glossary for future use

## Testing

Refresh your browser at http://localhost:5173 and test with terms like:

- 귀복주의 → should translate to "prosperity gospel"
- 번영신학 → should translate to "prosperity theology"
- 칭의 → should translate to "justification"
- 성화 → should translate to "sanctification"

## Adding More Terms

To add additional theological terms:

1. **For instant translation**: Add to `BASE_DICTIONARY` in `app.js`
2. **For Ollama guidance**: Add to the prompt examples in `server.js` (line 169-186)

Both approaches can be used together for best results.
