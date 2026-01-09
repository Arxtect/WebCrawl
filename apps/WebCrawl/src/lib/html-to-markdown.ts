import {postProcessMarkdown} from '@mendable/firecrawl-rs';
import type {Logger} from 'winston';

import {logger} from './logger';

export async function parseMarkdown(
    html: string|null|undefined,
    context?: {logger?: Logger; requestId?: string;},
    ): Promise<string> {
  if (!html) {
    return '';
  }

  const contextLogger = context?.logger || logger;

  // Turndown handles HTML -> Markdown conversion
  var TurndownService = require('turndown');
  var turndownPluginGfm = require('@joplin/turndown-plugin-gfm');

  const turndownService = new TurndownService();
  interface InlineLinkOptions {
    linkStyle?: string;
    [key: string]: any;
  }

  interface InlineLinkNode extends Element {
    getAttribute(name: string): string|null;
    title?: string;
    nodeName: string;
  }

  interface TurndownRule {
    filter: (node: Node, options: InlineLinkOptions) => boolean;
    replacement: (content: string, node: InlineLinkNode) => string;
  }

  const inlineLinkRule: TurndownRule = {
    filter: function(node: Node, options: InlineLinkOptions) {
      const el = node as InlineLinkNode;
      return (
          options.linkStyle === 'inlined' && el.nodeName === 'A' &&
          !!el.getAttribute('href'));
    },
    replacement: function(content: string, node: InlineLinkNode) {
      var href = node.getAttribute('href')!.trim();
      var title = node.title ? ' "' + node.title + '"' : '';
      return '[' + content.trim() + '](' + href + title + ')\n';
    },
  };

  turndownService.addRule('inlineLink', inlineLinkRule as any);
  var gfm = turndownPluginGfm.gfm;
  turndownService.use(gfm);

  try {
    let markdownContent = await turndownService.turndown(html);
    markdownContent = await postProcessMarkdown(markdownContent);

    return markdownContent;
  } catch (error) {
    contextLogger.error('Error converting HTML to Markdown', {error});
    return '';  // Optionally return an empty string or handle the error as
                // needed
  }
}
