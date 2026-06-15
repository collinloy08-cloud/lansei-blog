window.BLOG_CONTENT = {
  "version": 3,
  "site": {
    "name": {
      "zh": "岚生的个人博客",
      "en": "Lansheng's Blog"
    },
    "initials": {
      "zh": "岚",
      "en": "L"
    },
    "title": {
      "zh": "岚生的个人博客",
      "en": "Lansheng's Blog"
    },
    "subtitle": {
      "zh": "科研笔记、散文与长期观察。",
      "en": "Research notes, essays, and long-term observations."
    },
    "description": {
      "zh": "科研收获、论文理解、散文纪事与长期写作。",
      "en": "Research notes, paper readings, essays, and long-form personal writing."
    },
    "defaultTheme": "light",
    "homeTitle": {
      "zh": "在模型与人间之间写作",
      "en": "Writing Between Models and the Human World"
    },
    "homeDescription": {
      "zh": "这里记录多模态、深度学习和大模型的科研收获，也保存一些散文、纪事和认真经营过的自我叙事。首页放最近文章，归档放长期积累。",
      "en": "This site collects my research notes on multimodal learning, deep learning, and large models, alongside essays, field notes, and deliberately crafted personal narratives."
    },
    "homeSlogan": {
      "zh": "科研笔记 / 论文精读 / 散文纪事",
      "en": "Research Notes / Paper Reading / Essays"
    },
    "latestCount": 5
  },
  "author": {
    "name": {
      "zh": "岚生",
      "en": "Lansheng"
    },
    "bio": {
      "zh": "北京某211计算机专业本科生，目标方向包括多模态、大模型和自然语言处理。",
      "en": "I study multimodal learning and large models, while trying to write research life with a little more texture."
    },
    "location": "Beijing,China"
  },
  "categories": [
    {
      "id": "multimodal",
      "label": {
        "zh": "多模态",
        "en": "Multimodal"
      },
      "description": {
        "zh": "视觉、语言、声音和跨模态表征。",
        "en": "Vision, language, audio, and cross-modal representation."
      }
    },
    {
      "id": "deep-learning",
      "label": {
        "zh": "深度学习",
        "en": "Deep Learning"
      },
      "description": {
        "zh": "模型结构、训练、优化和泛化。",
        "en": "Architectures, training, optimization, and generalization."
      }
    },
    {
      "id": "llm",
      "label": {
        "zh": "大模型",
        "en": "Large Models"
      },
      "description": {
        "zh": "LLM、RAG、Agent 和上下文工程。",
        "en": "LLMs, RAG, agents, and context engineering."
      }
    },
    {
      "id": "paper",
      "label": {
        "zh": "论文精读",
        "en": "Paper Reading"
      },
      "description": {
        "zh": "把一篇论文真正拆开、读懂、复盘。",
        "en": "Careful paper notes, method breakdowns, and reusable questions."
      }
    },
    {
      "id": "essay",
      "label": {
        "zh": "散文纪事",
        "en": "Essays"
      },
      "description": {
        "zh": "把日常、城市、阅读和情绪写成作品。",
        "en": "Personal essays about cities, reading, campus life, and memory."
      }
    }
  ],
  "posts": [
    {
      "slug": "multimodal-alignment",
      "title": {
        "zh": "多模态学习到底在对齐什么",
        "en": "What Is Multimodal Learning Actually Aligning?"
      },
      "category": "multimodal",
      "date": "2026.06.13",
      "excerpt": {
        "zh": "从表示空间、跨模态注意力、视觉语言预训练到评测陷阱，整理我对多模态模型的阶段性理解。",
        "en": "A staged understanding of multimodal models, from representation spaces and cross-modal attention to VLM pretraining and evaluation traps."
      },
      "tags": [
        "VLM",
        "Alignment",
        "Representation"
      ],
      "featured": true,
      "status": "published",
      "body": {
        "zh": "## 一句话\n\n多模态学习不是把图片和文字硬塞进同一个向量空间，而是让模型在不同感知通道之间建立可迁移、可推理、可验证的语义关系。\n\n## 我目前的理解\n\n最直观的对齐是表示空间对齐：图像 encoder 和文本 encoder 输出的向量能在同一个空间里互相检索。CLIP 这类方法让我们看到，对比学习能把大量弱配对数据变成可用的跨模态监督。\n\n但真正麻烦的部分不只是“像不像”，而是模型是否理解关系、属性、动作、数量和上下文。比如一张图里有两个人、一只杯子和一个动作，文字描述往往不是对整张图的平均摘要，而是对某些视觉细节的选择性组织。\n\n## 值得继续追问\n\n- 视觉语言模型到底记住的是语义，还是数据集偏差？\n- 评测中看似正确的回答，有多少来自语言先验？\n- 多模态模型是否需要更细粒度的 grounded supervision？\n\n## 对我的启发\n\n以后读 VLM 论文时，我会把问题拆成三层：表示是否对齐、任务是否有效、推理是否可信。只看 benchmark 分数，很容易被模型的表面能力骗过。",
        "en": "## One Sentence\n\nMultimodal learning is not simply forcing images and text into the same vector space. It is about building semantic relations that can transfer, reason, and be verified across different perceptual channels.\n\n## My Current Understanding\n\nThe most intuitive form of alignment is representation alignment: an image encoder and a text encoder produce vectors that can retrieve each other in a shared space. Methods like CLIP show that contrastive learning can turn large amounts of weak image-text pairs into useful supervision.\n\nBut the difficult part is not only whether two embeddings are close. The harder question is whether the model understands relations, attributes, actions, quantities, and context. A caption is rarely an average summary of the whole image. It is often a selective organization of visual details.\n\n## Questions To Keep Asking\n\n- Does a VLM remember semantics or dataset bias?\n- How much of a correct answer comes from language priors?\n- Do multimodal models need finer grounded supervision?\n\n## Takeaway\n\nWhen I read VLM papers, I now split the problem into three layers: representation alignment, task effectiveness, and trustworthy reasoning. Benchmark scores alone can be very misleading."
      }
    },
    {
      "slug": "attention-is-all-you-need",
      "title": {
        "zh": "论文精读 | Attention Is All You Need",
        "en": "Paper Reading | Attention Is All You Need"
      },
      "category": "paper",
      "date": "2026.06.10",
      "excerpt": {
        "zh": "从 self-attention、位置编码到复杂度优势，记录 Transformer 为什么能成为后来大模型的基础骨架。",
        "en": "A close reading of self-attention, positional encoding, and why the Transformer became the backbone of modern large models."
      },
      "tags": [
        "Transformer",
        "Attention",
        "Paper"
      ],
      "featured": true,
      "status": "published",
      "body": {
        "zh": "## 背景问题\n\n在 Transformer 之前，序列建模很依赖 RNN 或 CNN。RNN 有天然的顺序瓶颈，CNN 虽然能并行，但长距离依赖需要堆叠很多层。\n\n## 核心方法\n\nTransformer 最激进的地方，是把 recurrence 完全拿掉，只用 attention 来建模 token 之间的关系。Self-attention 允许序列中的每个位置直接看到其他位置，这使得长距离依赖不再需要一步一步传递。\n\n## 我真正理解了什么\n\nAttention 的价值不只是“关注重要部分”，而是把序列建模改写成一个动态的信息路由问题。每个 token 都可以根据当前表示，决定要从哪些 token 那里拿信息。\n\n## 重要细节\n\n- Multi-head attention 让模型在不同子空间中学习不同关系。\n- Positional encoding 解决的是顺序信息缺失。\n- 残差连接和 layer norm 是训练稳定性的关键。\n\n## 对我的启发\n\n读经典论文时，不要只记住模型结构图。真正该追的是：它改变了哪个计算瓶颈，后续工作又沿着哪个弱点继续推进。",
        "en": "## Background\n\nBefore the Transformer, sequence modeling relied heavily on RNNs or CNNs. RNNs had a sequential bottleneck. CNNs could be parallelized, but long-range dependencies often required deep stacks.\n\n## Core Method\n\nThe radical move of the Transformer was to remove recurrence entirely and model relations between tokens with attention. Self-attention lets every position directly attend to every other position, so long-range dependencies no longer need to be passed step by step.\n\n## What I Actually Learned\n\nAttention is not just about focusing on important parts. It reframes sequence modeling as dynamic information routing. Each token decides where to retrieve information from based on its current representation.\n\n## Details Worth Remembering\n\n- Multi-head attention learns different relations in different subspaces.\n- Positional encoding compensates for the missing order information.\n- Residual connections and layer normalization are crucial for stable training.\n\n## Takeaway\n\nWhen reading classic papers, I should not only memorize architecture diagrams. The real question is which computational bottleneck the paper changed and which weakness later work continued to attack."
      }
    },
    {
      "slug": "rag-agent-context",
      "title": {
        "zh": "大模型应用：RAG、Agent 与上下文工程",
        "en": "LLM Applications: RAG, Agents, and Context Engineering"
      },
      "category": "llm",
      "date": "2026.05.29",
      "excerpt": {
        "zh": "RAG 不是简单把文档塞进提示词，Agent 也不只是循环调用工具。关键是信息边界和可验证输出。",
        "en": "RAG is not just stuffing documents into prompts, and agents are not just loops of tool calls. The key is boundary control and verifiable output."
      },
      "tags": [
        "LLM",
        "RAG",
        "Agent"
      ],
      "featured": false,
      "status": "published",
      "body": {
        "zh": "## RAG 的核心\n\nRAG 的重点不是“接入知识库”这个动作，而是把外部信息变成模型当前任务中可使用、可追溯、可约束的上下文。\n\n## Agent 的问题\n\nAgent 听起来很炫，但真正落地时，麻烦往往来自任务边界不清、工具返回不可控、循环缺少停止条件。很多所谓 Agent 系统，其实只是把错误放大得更自动。\n\n## 上下文工程\n\n上下文工程要回答三个问题：给模型什么，不给什么，如何让模型知道什么是可信的。这比写一段漂亮 prompt 更重要。\n\n## 我的实践原则\n\n- 检索结果要短，但要有来源。\n- 工具调用要有明确输入输出格式。\n- 最终答案要能被外部材料验证。\n- 不要让模型在没有证据的地方装作知道。",
        "en": "## The Core of RAG\n\nRAG is not mainly about connecting a knowledge base. It is about turning external information into context that is usable, traceable, and constrained for the current task.\n\n## The Problem With Agents\n\nAgents sound impressive, but real systems often fail because task boundaries are vague, tool outputs are unstable, and loops lack stopping conditions. Many agent systems simply automate the amplification of errors.\n\n## Context Engineering\n\nContext engineering asks three questions: what should the model see, what should be excluded, and how does the model know what is trustworthy? This matters more than a pretty prompt.\n\n## My Practical Rules\n\n- Retrieved results should be short but sourced.\n- Tool calls need clear input and output formats.\n- Final answers should be externally verifiable.\n- The model should not pretend to know without evidence."
      }
    }
  ],
  "now": {
    "items": [
      {
        "label": {
          "zh": "正在读",
          "en": "Reading"
        },
        "value": {
          "zh": "多模态大模型综述、VLM 评测与 Attention 效率相关论文",
          "en": "Surveys on multimodal large models, VLM evaluation, and attention efficiency papers"
        }
      },
      {
        "label": {
          "zh": "正在写",
          "en": "Writing"
        },
        "value": {
          "zh": "论文精读、科研周记，以及一些略带做作但有效的散文",
          "en": "Paper readings, research logs, and a few deliberately polished essays"
        }
      },
      {
        "label": {
          "zh": "下一步",
          "en": "Next"
        },
        "value": {
          "zh": "把真实论文笔记迁移成可搜索、可归档的文章",
          "en": "Turning real paper notes into searchable, archived posts"
        }
      }
    ]
  },
  "socials": [
    {
      "label": "Email",
      "url": "lanseidesu@proton.me"
    },
    {
      "label": "Google Scholar",
      "url": "https://scholar.google.com/"
    },
    {
      "label": "GitHub",
      "url": "https://github.com/"
    },
    {
      "label": "RSS",
      "url": "#"
    }
  ],
  "footer": {
    "zh": "© 2026 岚生的个人博客",
    "en": "© 2026 Lansheng's Blog"
  }
};
