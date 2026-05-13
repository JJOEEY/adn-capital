const CUSTOMER_HEADING_PATTERN =
  /(?:#{1,3}\s*)?(?:\*\*)?(?:Ph\S*n\s+t\S*ch|AIDEN|VN-|[A-Z]{2,5}\b)/i;

export function sanitizeCustomerVisibleAiText(input: string): string {
  if (!input) return input;

  let output = input
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
    .replace(/```(?:think|thinking|reasoning|analysis)[\s\S]*?```/gi, "")
    .replace(/^\s*<\/think>\s*/gi, "")
    .replace(/^\s*<\/thinking>\s*/gi, "");

  output = stripUnclosedReasoningTag(output, /<think\b[^>]*>/i);
  output = stripUnclosedReasoningTag(output, /<thinking\b[^>]*>/i);

  const lines = output.split(/\r?\n/);
  while (
    lines.length > 0 &&
    /^\s*(?:okay|ok,|let's|we need|we should|i need|i should|the user|user asks|analysis:|reasoning:|thought:)/i.test(
      lines[0],
    )
  ) {
    lines.shift();
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripUnclosedReasoningTag(text: string, tagPattern: RegExp): string {
  const match = tagPattern.exec(text);
  if (!match || match.index == null) return text;

  const before = text.slice(0, match.index);
  const afterOpenTag = text.slice(match.index + match[0].length);
  const customerHeading = CUSTOMER_HEADING_PATTERN.exec(afterOpenTag);

  if (!customerHeading || customerHeading.index == null) {
    return before.trim();
  }

  return `${before}${afterOpenTag.slice(customerHeading.index)}`.trim();
}
