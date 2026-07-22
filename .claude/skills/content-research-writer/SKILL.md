---
name: content-research-writer
description: Assists in writing high-quality content by conducting research, adding citations, improving hooks, iterating on outlines, and providing real-time feedback on each section. Transforms your writing process from solo effort to collaborative partnership.
---

# Content Research Writer（AGELOCKED 專屬版）

This skill acts as your writing partner for AGELOCKED blog, helping you research, outline, draft, and refine content while maintaining the brand's voice and funnel strategy.

## ⚡ 啟動必做：讀取網站策略

**每次啟動此 Skill，第一步必須讀取 `.claude/agelocked-strategy.md`。**

讀取後，確認以下資訊再開始任何寫作工作：
- 這篇文章位於哪個漏斗位置（上/中/中下/下）？
- 應使用哪個 CTA（軟出口清單 or 硬出口掃描預約）？
- 文章結尾的內部連結應導向哪個下一篇？
- 哪些寫作禁忌需要避免？

## When to Use This Skill

- 撰寫 AGELOCKED 部落格文章
- 規劃文章大綱與內容漏斗定位
- 進行科學研究與引用文獻
- 改寫 Hook 讓讀者認出自己的場景
- 逐段審查文章內容與語調
- 確認 CTA 邏輯與內部連結是否符合策略

## What This Skill Does

1. **策略定位確認**: 確認文章的漏斗位置、CTA 選擇、內部連結方向
2. **Collaborative Outlining**: 依 AGELOCKED 文章結構幫助規劃大綱
3. **Research Assistance**: 找相關科學文獻並加入正確引用格式
4. **Hook Improvement**: 強化開場讓讀者認出自己的場景
5. **Section Feedback**: 逐段審查語調、禁忌用法、漏斗邏輯
6. **Voice Preservation**: 維持孫義坤的寫作語調（非醫療、非術語、生活化）
7. **Citation Management**: 格式化學術引用（符合現有文章格式）

## How to Use

### Setup Your Writing Environment

Create a dedicated folder for your article:
```
mkdir ~/writing/my-article-title
cd ~/writing/my-article-title
```

Create your draft file:
```
touch article-draft.md
```

Open Claude Code from this directory and start writing.

### Basic Workflow

1. **Start with an outline**:
```
Help me create an outline for an article about [topic]
```

2. **Research and add citations**:
```
Research [specific topic] and add citations to my outline
```

3. **Improve the hook**:
```
Here's my introduction. Help me make the hook more compelling.
```

4. **Get section feedback**:
```
I just finished the "Why This Matters" section. Review it and give feedback.
```

5. **Refine and polish**:
```
Review the full draft for flow, clarity, and consistency.
```

## Instructions

When a user requests writing assistance:

0. **載入 AGELOCKED 網站策略（必做第一步）**

   立即讀取 `.claude/agelocked-strategy.md`，從中提取：
   - 受眾定位與核心訊息（第一節）
   - CTA 兩層邏輯（第二節）
   - 這篇文章對應的漏斗位置（第三節）
   - 文章分類與收錄標準（第四節）
   - 寫作原則與禁止事項（第九節）

   確認後，向使用者回報：
   > 「已讀取策略。這篇文章屬於【X漏斗】，CTA 使用【軟/硬出口】，內部連結導向【下一篇主題】。開始規劃。」

1. **Understand the Writing Project**

   Ask clarifying questions:
   - 這篇文章的主題和核心論點？
   - 漏斗位置：上/中/中下/下漏斗？
   - 文章分類：身體訊號解讀/慢性發炎科學/精準健康工具/介入與調校？
   - 有沒有指定要引用的研究或資料來源？
   - 文章要連結到哪篇已完成的文章（內部連結）？

2. **Collaborative Outlining**
   
   Help structure the content:
   
   ```markdown
   # Article Outline: [Title]
   
   ## Hook
   - [Opening line/story/statistic]
   - [Why reader should care]
   
   ## Introduction
   - Context and background
   - Problem statement
   - What this article covers
   
   ## Main Sections
   
   ### Section 1: [Title]
   - Key point A
   - Key point B
   - Example/evidence
   - [Research needed: specific topic]
   
   ### Section 2: [Title]
   - Key point C
   - Key point D
   - Data/citation needed
   
   ### Section 3: [Title]
   - Key point E
   - Counter-arguments
   - Resolution
   
   ## Conclusion
   - Summary of main points
   - Call to action
   - Final thought
   
   ## Research To-Do
   - [ ] Find data on [topic]
   - [ ] Get examples of [concept]
   - [ ] Source citation for [claim]
   ```
   
   **Iterate on outline**:
   - Adjust based on feedback
   - Ensure logical flow
   - Identify research gaps
   - Mark sections for deep dives

3. **Conduct Research**
   
   When user requests research on a topic:
   
   - Search for relevant information
   - Find credible sources
   - Extract key facts, quotes, and data
   - Add citations in requested format
   
   Example output:
   ```markdown
   ## Research: AI Impact on Productivity
   
   Key Findings:
   
   1. **Productivity Gains**: Studies show 40% time savings for 
      content creation tasks [1]
   
   2. **Adoption Rates**: 67% of knowledge workers use AI tools 
      weekly [2]
   
   3. **Expert Quote**: "AI augments rather than replaces human 
      creativity" - Dr. Jane Smith, MIT [3]
   
   Citations:
   [1] McKinsey Global Institute. (2024). "The Economic Potential 
       of Generative AI"
   [2] Stack Overflow Developer Survey (2024)
   [3] Smith, J. (2024). MIT Technology Review interview
   
   Added to outline under Section 2.
   ```

4. **Improve Hooks**
   
   When user shares an introduction, analyze and strengthen:
   
   **Current Hook Analysis**:
   - What works: [positive elements]
   - What could be stronger: [areas for improvement]
   - Emotional impact: [current vs. potential]
   
   **Suggested Alternatives**:
   
   Option 1: [Bold statement]
   > [Example]
   *Why it works: [explanation]*
   
   Option 2: [Personal story]
   > [Example]
   *Why it works: [explanation]*
   
   Option 3: [Surprising data]
   > [Example]
   *Why it works: [explanation]*
   
   **Questions to hook**:
   - Does it create curiosity?
   - Does it promise value?
   - Is it specific enough?
   - Does it match the audience?

5. **Provide Section-by-Section Feedback**

   As user writes each section, review for:

   ```markdown
   # Feedback: [Section Name]

   ## What Works Well ✓
   - [Strength 1]
   - [Strength 2]
   - [Strength 3]

   ## AGELOCKED 策略檢查

   ### 語調禁忌
   - [ ] 沒有使用「盲目」「憑感覺」等負面標籤
   - [ ] 沒有給出醫療建議或解讀體檢數值
   - [ ] 沒有使用科技隱喻括號（技術債、系統負載等）
   - [ ] 沒有在第一次接觸就推「預約見面」
   - [ ] 表格不出現在文章中段

   ### 漏斗邏輯
   - [ ] 文章痛點符合目標漏斗位置的讀者心理狀態
   - [ ] CTA 使用正確出口（軟/硬）
   - [ ] 結尾內部連結指向正確的下一篇

   ## Suggestions for Improvement

   ### Clarity
   - [Specific issue] → [Suggested fix]
   - [Complex sentence] → [Simpler alternative]

   ### Flow
   - [Transition issue] → [Better connection]
   - [Paragraph order] → [Suggested reordering]

   ### Evidence
   - [Claim needing support] → [Add citation or example]
   - [Generic statement] → [Make more specific]

   ### Style
   - [Tone inconsistency] → [Match your voice better]
   - [Word choice] → [Stronger alternative]

   ## Specific Line Edits

   Original:
   > [Exact quote from draft]

   Suggested:
   > [Improved version]

   Why: [Explanation]

   Ready to move to next section!
   ```

6. **Preserve Writer's Voice**
   
   Important principles:
   
   - **Learn their style**: Read existing writing samples
   - **Suggest, don't replace**: Offer options, not directives
   - **Match tone**: Formal, casual, technical, friendly
   - **Respect choices**: If they prefer their version, support it
   - **Enhance, don't override**: Make their writing better, not different
   
   Ask periodically:
   - "Does this sound like you?"
   - "Is this the right tone?"
   - "Should I be more/less [formal/casual/technical]?"

7. **Citation Management**
   
   Handle references based on user preference:
   
   **Inline Citations**:
   ```markdown
   Studies show 40% productivity improvement (McKinsey, 2024).
   ```
   
   **Numbered References**:
   ```markdown
   Studies show 40% productivity improvement [1].
   
   [1] McKinsey Global Institute. (2024)...
   ```
   
   **Footnote Style**:
   ```markdown
   Studies show 40% productivity improvement^1
   
   ^1: McKinsey Global Institute. (2024)...
   ```
   
   Maintain a running citations list:
   ```markdown
   ## References
   
   1. Author. (Year). "Title". Publication.
   2. Author. (Year). "Title". Publication.
   ...
   ```

8. **Final Review and Polish**
   
   When draft is complete, provide comprehensive feedback:
   
   ```markdown
   # Full Draft Review
   
   ## Overall Assessment
   
   **Strengths**:
   - [Major strength 1]
   - [Major strength 2]
   - [Major strength 3]
   
   **Impact**: [Overall effectiveness assessment]
   
   ## Structure & Flow
   - [Comments on organization]
   - [Transition quality]
   - [Pacing assessment]
   
   ## Content Quality
   - [Argument strength]
   - [Evidence sufficiency]
   - [Example effectiveness]
   
   ## Technical Quality
   - Grammar and mechanics: [assessment]
   - Consistency: [assessment]
   - Citations: [completeness check]
   
   ## Readability
   - Clarity score: [evaluation]
   - Sentence variety: [evaluation]
   - Paragraph length: [evaluation]
   
   ## Final Polish Suggestions
   
   1. **Introduction**: [Specific improvements]
   2. **Body**: [Specific improvements]
   3. **Conclusion**: [Specific improvements]
   4. **Title**: [Options if needed]
   
   ## Pre-Publish Checklist
   - [ ] All claims sourced
   - [ ] Citations formatted
   - [ ] Examples clear
   - [ ] Transitions smooth
   - [ ] Call to action present
   - [ ] Proofread for typos
   
   Ready to publish! 🚀
   ```

## Examples

### Example 1: Teresa Torres's Workflow

**User**: "I'm writing an article about continuous discovery. Help me create an outline."

**Process**:
1. Collaborates on outline structure
2. Identifies research needs
3. User starts writing introduction
4. Reviews and improves the hook
5. User writes each section
6. Provides feedback after each section
7. Conducts research and adds citations
8. Final review of complete draft
9. Polish and prep for publishing

**Result**: Well-researched, properly cited article written in Teresa's voice with strong structure and flow.

### Example 2: Research-Heavy Article

**User**: "I'm writing about AI's impact on product management. Help me find current data and examples."

**Output**:
```markdown
## Research Compiled

### Recent Data
- Gartner: 80% of PMs will use AI tools by 2025 [1]
- Survey: 45% report faster feature shipping [2]
- Case study: Airbnb's AI-assisted prioritization [3]

### Expert Quotes
- "AI amplifies PM judgment, not replaces it" - Marty Cagan
- [Additional quotes with citations]

### Real Examples
1. **Company A**: Used AI for user research synthesis
   - Result: 60% time savings
   - Source: [citation]

2. **Company B**: AI-powered roadmap analysis
   - Result: Better stakeholder alignment
   - Source: [citation]

All added to your outline with proper citations.
```

### Example 3: Hook Improvement

**User's Original Hook**:
> "Product management is changing because of AI. In this article, I'll discuss some ways AI affects product managers."

**Improved Options**:

**Option 1 (Data-driven)**:
> "Last month, I asked AI to analyze 500 customer interviews. It took 30 minutes instead of 3 weeks. Product management will never be the same."

**Option 2 (Question)**:
> "What if you could talk to every customer, read every review, and analyze every support ticket—all before your morning coffee?"

**Option 3 (Story)**:
> "Sarah spent two weeks building the wrong feature. Not because she didn't understand her users, but because she couldn't process the hundreds of interviews fast enough to spot the pattern."

### Example 4: Section Feedback

**User**: "Just finished my 'Common Mistakes' section. Thoughts?"

**Response**:
```markdown
# Feedback: Common Mistakes Section

## What Works Well ✓
- Strong examples (the Slack notification story)
- Clear structure (3 mistakes, clean layout)
- Practical advice for each mistake

## Suggestions

### Make It More Specific
Your second point says "Bad prioritization" but could be stronger:

Current:
> "Many teams prioritize badly by focusing on features instead of outcomes."

Suggested:
> "I've watched teams ship 14 features in a quarter yet move none of their key metrics. They prioritized activity over progress."

### Add Data
The third mistake would benefit from evidence:
> "[Add citation]: Studies show teams without regular user contact are 3x more likely to build unused features [needs source]"

### Flow Improvement
Consider reordering: Mistake 3 → Mistake 2 → Mistake 1
This builds from small to big impact.

Ready for the next section!
```

## Writing Workflows

### Blog Post Workflow
1. Outline together
2. Research key points
3. Write introduction → get feedback
4. Write body sections → feedback each
5. Write conclusion → final review
6. Polish and edit

### Newsletter Workflow
1. Discuss hook ideas
2. Quick outline (shorter format)
3. Draft in one session
4. Review for clarity and links
5. Quick polish

### Technical Tutorial Workflow
1. Outline steps
2. Write code examples
3. Add explanations
4. Test instructions
5. Add troubleshooting section
6. Final review for accuracy

### Thought Leadership Workflow
1. Brainstorm unique angle
2. Research existing perspectives
3. Develop your thesis
4. Write with strong POV
5. Add supporting evidence
6. Craft compelling conclusion

## Pro Tips

1. **Work in VS Code**: Better than web Claude for long-form writing
2. **One section at a time**: Get feedback incrementally
3. **Save research separately**: Keep a research.md file
4. **Version your drafts**: article-v1.md, article-v2.md, etc.
5. **Read aloud**: Use feedback to identify clunky sentences
6. **Set deadlines**: "I want to finish the draft today"
7. **Take breaks**: Write, get feedback, pause, revise

## File Organization

Recommended structure for writing projects:

```
~/writing/article-name/
├── outline.md          # Your outline
├── research.md         # All research and citations
├── draft-v1.md         # First draft
├── draft-v2.md         # Revised draft
├── final.md            # Publication-ready
├── feedback.md         # Collected feedback
└── sources/            # Reference materials
    ├── study1.pdf
    └── article2.md
```

## Best Practices

### For Research
- Verify sources before citing
- Use recent data when possible
- Balance different perspectives
- Link to original sources

### For Feedback
- Be specific about what you want: "Is this too technical?"
- Share your concerns: "I'm worried this section drags"
- Ask questions: "Does this flow logically?"
- Request alternatives: "What's another way to explain this?"

### For Voice
- Share examples of your writing
- Specify tone preferences
- Point out good matches: "That sounds like me!"
- Flag mismatches: "Too formal for my style"

## Related Use Cases

- Creating social media posts from articles
- Adapting content for different audiences
- Writing email newsletters
- Drafting technical documentation
- Creating presentation content
- Writing case studies
- Developing course outlines

