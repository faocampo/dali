import type {BrowserContext, Page, TestInfo} from '@playwright/test';

/** Chromium exercises the OS clipboard; other engines exercise native payload routing. */
export async function prepareClipboard(page:Page,context:BrowserContext,browserName:string,testInfo:TestInfo,expectErrors:string[]){
  if(browserName==='chromium'){await context.grantPermissions(['clipboard-read','clipboard-write']);return;}
  testInfo.annotations.push({type:'evidence-limit',description:'Clipboard payload-route simulation; native OS clipboard integration remains unverified in this engine.'});
  // Pinned native tryGetSvgFromClipboard parses empty plain text even when
  // the actual object payload is HTML. Firefox logs this benign parser result.
  if(browserName==='firefox')expectErrors.push('XML Parsing Error: no root element found');
  await page.addInitScript(()=>{
    let items:ClipboardItem[]=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      write:async(value:ClipboardItem[])=>{items=value;},read:async()=>items,
      writeText:async(value:string)=>{items=[new ClipboardItem({'text/plain':new Blob([value],{type:'text/plain'})})];},
      readText:async()=>{const item=items.find(item=>item.types.includes('text/plain'));return item?(await item.getType('text/plain')).text():'';},
    }});
  });
}

export async function pasteClipboard(page:Page,browserName:string){
  if(browserName==='chromium'){await page.keyboard.press('ControlOrMeta+v');return;}
  await page.evaluate(async()=>{
    const data=new DataTransfer();
    for(const item of await navigator.clipboard.read())for(const type of item.types)data.setData(type,await(await item.getType(type)).text());
    const event=new Event('paste',{bubbles:true,composed:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:data});
    document.querySelector('editor-host')!.dispatchEvent(event);
  });
}
