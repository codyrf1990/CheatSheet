# SolidCAM Cheat Sheet – Project Instructions

## CRITICAL: Archon Integration & Workflow

This project uses **Archon MCP server** for knowledge management, task tracking, and project organization. **ALWAYS start with Archon MCP server task management.**

### Core Workflow: Task-Driven Development

**MANDATORY task cycle before coding:**

1. **Get Task** → `find_tasks(task_id="...")` or `find_tasks(filter_by="status", filter_value="todo")`
2. **Start Work** → `manage_task("update", task_id="...", status="doing")`
3. **Research** → Use knowledge base (see RAG workflow below)
4. **Implement** → Write code based on research
5. **Review** → `manage_task("update", task_id="...", status="review")`
6. **Next Task** → `find_tasks(filter_by="status", filter_value="todo")`

**NEVER skip task updates. NEVER code without checking current tasks first.**

### RAG Workflow (Research Before Implementation)

**Searching Specific Documentation:**
```javascript
// 1. Get sources
rag_get_available_sources() // Returns list with id, title, url

// 2. Find source ID (match to documentation, e.g., "Supabase docs" → "src_abc123")

// 3. Search
rag_search_knowledge_base(query="vector functions", source_id="src_abc123")
```

**General Research:**
```javascript
// Search knowledge base (2-5 keywords only!)
rag_search_knowledge_base(query="authentication JWT", match_count=5)

// Find code examples
rag_search_code_examples(query="React hooks", match_count=3)
```

### Tool Reference

**Projects:**
- `find_projects(query="...")` - Search projects
- `find_projects(project_id="...")` - Get specific project
- `manage_project("create"/"update"/"delete", ...)` - Manage projects

**Tasks:**
- `find_tasks(query="...")` - Search tasks by keyword
- `find_tasks(task_id="...")` - Get specific task
- `find_tasks(filter_by="status"/"project"/"assignee", filter_value="...")` - Filter tasks
- `manage_task("create"/"update"/"delete", ...)` - Manage tasks

**Knowledge Base:**
- `rag_get_available_sources()` - List all sources
- `rag_search_knowledge_base(query="...", source_id="...")` - Search docs
- `rag_search_code_examples(query="...", source_id="...")` - Find code

**Important Notes:**
- Task status flow: `todo` → `doing` → `review` → `done`
- Keep queries SHORT (2-5 keywords) for better search results
- Higher task_order = higher priority (0-100)
- Tasks should be 30 min - 4 hours of work

---

## Architecture

**Entry Point:** `index.html` → `assets/css/main.css` + `assets/js/app.js`

**Bootstrap:** `app.js` initializes:
- `dom.js` - Main UI rendering (`renderApp`)
- `calculator.js` - Calculator logic
- `email-templates.js` - Template management
- `chatbot/chatbot.js` - AI chatbot system

**State Management:**
- `data.js` - Default seed data (packages, sidebar items, header links)
- `persistence.js` - localStorage wrapper (`saveState`, `loadState`, `clearState`) using key `solidcam-cheatsheet-state`
- `collectState` / `applyState` in `dom.js` - Serialization/hydration

**Core Modules:**
- `drag-and-drop.js` - Sortable system (emits `sortable:drop` events)
- `copy.js` - Click-to-copy for `<code>` elements
- `chatbot/` - Multi-file chatbot: UI, API, context, RAG, storage

## Core Behaviors

**Package Table:**
- Add/remove mode toggles (left), edit/reset controls (right)
- `Edit Order` enables drag-and-drop; `Reset Order` clears storage; `Reset Checks` unchecks boxes
- Add mode: row-level `+` buttons append bits
- Remove mode: `×` buttons on bits and master groups

**Drag & Drop:**
- Scope: `package-bits` - all containers accept items
- Events: `sortable:drop` with `{ item, from, to }`
- Empty master groups auto-remove
- Active only in edit mode (dashed borders, gold accents)

**Sidebar Cards:**
- Three panels: Standalone Modules, Maintenance SKUs, SolidWorks Maintenance
- Two-column pill grid with `+`/`−` controls
- Delete mode shows inline `×` buttons

**Persistence:**
- ALL structural changes call `persistState`
- Update both `collectState` and `applyState` when adding state fields
- Always use `persistence.js` helpers, never direct localStorage

**Chatbot System:**
- RAG-enabled AI assistant with context awareness
- Manages conversations, prompts, and API settings via localStorage
- Multi-file architecture: UI, API manager, context processor, RAG engine, storage

## Design Constraints

**Styling:**
- Dark gradient backgrounds with SolidCAM red/gold highlights (do not alter palette)
- Compact spacing for single 1080p viewport fit
- Edit mode: dashed borders (`body.edit-mode`) and gold outlines on drop targets
- ASCII-only unless explicitly required

**Technical:**
- No build tooling - runs directly in browser (`file://` or static server)
- Manual testing expected - document test steps
- Framework-free vanilla JS

## Key Rules

1. Never revert user edits unless explicitly requested
2. Reference file paths and line numbers in responses
3. Extend `drag-and-drop.js` logic, don't replace it
4. Register new `<code>` elements via `registerCopyHandlers` in `copy.js`
5. Use `clearState()` or UI Reset to restore seed data from `data.js`
