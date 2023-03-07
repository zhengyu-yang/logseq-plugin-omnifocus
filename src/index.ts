import "@logseq/libs";
import { BlockEntity } from '@logseq/libs/dist/LSPlugin'
import removeMarkdown from 'remove-markdown';

const settings = [
  {
    key: "KeyboardShortcut_SendToOmniFocus",
    title: "Keyboard shortcut to send a block to OmniFocus",
    description: "This is the the keyboard shortcut to send a block to OmniFocus (default: mod+ctrl+o)",
    type: "string",
    default: "mod+ctrl+o"
  } as const
];
logseq.useSettingsSchema(settings);

// ref: https://github.com/ahonn/logseq-plugin-todo/blob/6cf084a2419b9c6df78e5eb32ae5d06d73afe4e4/src/models/TaskEntity.ts
function get_clean_block_content(block: BlockEntity) {
  let content = block.content;
  content = content.replace(block.marker, '');
  content = content.replace(`[#${block.priority}]`, '');
  content = content.replace(/SCHEDULED: <[^>]+>/, '');
  content = content.replace(/DEADLINE: <[^>]+>/, '');
  content = content.replace(/(:LOGBOOK:)|(\*\s.*)|(:END:)|(CLOCK:.*)/gm, '');
  content = content.replace(/id::[^:]+/, '');
  content = removeMarkdown(content);
  return content.trim();
}

function convert_logseq_date(date: number | undefined) {
  if (date == undefined) {
    return "NULL";
  }
  const d = date.toString();
  const yyyy = +d.slice(0, 4);
  const mm = +d.slice(4, 6) - 1;
  const dd = +d.slice(6, 8);
  return (new Date(yyyy, mm, dd)).toISOString();
}

const of_js_new_task = `(args => {
  const task_name = args[0];
  const note = args[1];
  const dueDate = new Date(args[2]);
  const deferDate = new Date(args[3]);

  let logseq_tag = Tag.byIdentifier('logseq');
  if (logseq_tag == null){
      logseq_tag = new Tag('logseq');
  }

  let task = new Task(task_name);
  task.note = note;
  if (!isNaN(dueDate)){
      task.dueDate = dueDate;
  }
  if (!isNaN(deferDate)){
      task.deferDate = deferDate;
  }
  task.addTag(logseq_tag);
})(argument)`

async function block2OF(block: BlockEntity) {
  const content = get_clean_block_content(block);
  const name = content.split('\n')[0];

  const graph_name = (await logseq.App.getCurrentGraph())!.name;
  const logseq_block_url = `logseq://graph/${graph_name}?block-id=${block.uuid}`
  const note = (content + `\n\n------------\nLogSeq Link: ${logseq_block_url}`).replace(/\n/g, "\\n");;

  const defer_date = convert_logseq_date(block?.scheduled);
  const due_date = convert_logseq_date(block?.deadline);

  // let of_url = new URL('omnifocus://localhost/omnijs-run');   
  // of_url.searchParams.append('script', of_js_new_task);
  // of_url.searchParams.append('arg', `["${name}", "${note}", "${due_date}", "${defer_date}"]`);

  const of_url = `omnifocus://localhost/omnijs-run?script=${encodeURIComponent(of_js_new_task)}&arg=${encodeURIComponent(`["${name}", "${note}", "${due_date}", "${defer_date}"]`)}`;
  window.open(of_url);
}

async function selectedBlocks2OF() {
  let blocks = await logseq.Editor.getSelectedBlocks();
  // selected blocks from query result have duplication
  blocks = blocks!.filter((value, index, self) =>
    index === self.findIndex((t) => (
      t.uuid === value.uuid
    ))
  );

  blocks!.forEach(block2OF);
  logseq.UI.showMsg("Send to OmniFocus!");
}

async function main() {
  console.log("logseq-of-sorted-plugin loaded");

  logseq.App.registerCommandPalette({
    key: `tidy-blocks-KeyboardShortcut_SendToOmniFocus`,
    label: "Send to OmniFocus",
    keybinding: {
      binding: logseq.settings?.KeyboardShortcut_SendToOmniFocus,
      mode: "global",
    }
  }, async (e) => {
    selectedBlocks2OF();
  });

  logseq.Editor.registerSlashCommand("Send to OmniFocus", async (e) => {
    const block = await logseq.Editor.getBlock(e.uuid);
    block2OF(block!);
  });

  logseq.Editor.registerBlockContextMenuItem("Send to OmniFocus", async (e) => {
    const block = await logseq.Editor.getBlock(e.uuid);
    block2OF(block!);
  });

  // lose focus not working
  // logseq.App.registerUIItem("toolbar", {
  //   key: "logseq-send-to-omnifocus",
  //   template:
  //     `<a data-on-click="send2of" class="button">
  //       <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-circle-check" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  //         <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  //         <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
  //         <path d="M9 12l2 2l4 -4"></path>
  //       </svg>
  //     </a>`
  // });
  // logseq.provideModel({
  //   send2of(e) {
  //     console.log(e);
  //     e.preventDefault();      
  //     selectedBlocks2OF();
  //   }
  // });
}

logseq.ready(main).catch(console.error);
