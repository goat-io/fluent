  Reusable AI procedure for scaffolding a new roadmap phase

 1. Ingest the problem statement
 • Locate the master roadmap or “overall problem statement” file supplied by the user (they may give an explicit path or an alias such as @roadmap/plan/***.md).
 • Load its contents into memory.
 • Identify the phase you are being asked to build (e.g., “PHASE-1-GCP-FOUNDATION”). If the phase’s headline section already exists in the master file, use that subsection as source material; otherwise use the most recent plan section that discusses the upcoming phase.
 2. Generate the phase folder
 • Inside <PLAN_ROOT>/phases/, create a folder whose name is exactly the phase identifier you were given (PHASE-x-...).
 • If the folder already exists, leave existing artefacts untouched; create or overwrite only the files named in the next steps.
 3. Create the three feature-description files
 • Open the feature template directory provided by the user. There will be three templates whose filenames encode their abstraction level (for example: 01-high-level.md, 02-detailed.md, 03-technical.md).
 • Process them in lexical order so the most general template is filled first and the most technical last.
 • For each template:
 1. Copy the template’s contents into a new file in the phase folder, keeping the same filename.
 2. Replace template placeholders with information you extracted from the master problem statement, refining or expanding the detail as the template demands. Early templates should summarise; later templates should dive into specifics.
 4. Create the developer task files
 • Read every template contained in the task template directory. Each template represents one task card format (story, bug, spike, etc.).
 • For each of the three description files you just generated:
 1. Analyse its content and break the work into discrete developer-friendly tasks.
 2. For every task you identify, instantiate the appropriate task template, filling in title, acceptance criteria, effort estimate and any other required fields.
 3. Save each completed task file inside <PLAN_ROOT>/phases/<PHASE>/execution/. Use a consistent naming pattern such as NN-task-title.md, where NN is an incrementing two-digit sequence.
 5. Validation checklist before finishing
 • All three description files exist and no placeholder text remains.
 • Every task file follows the exact format of its originating task template.
 • The execution/ subfolder contains at least one task file for each description file.
 • References between tasks and their parent description (if the template requires a link or ID) are correctly set.

Follow these steps every time you receive a “plan” request so the process is fully automatic and repeatable across phases and projects.

$ARGUMENTS
