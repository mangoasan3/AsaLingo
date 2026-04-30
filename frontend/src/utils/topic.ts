import type { TFunction } from "@/i18n";
import { TOPIC_KEYS, type TopicKey } from "@/constants/topics";

const TOPIC_SET = new Set<string>(TOPIC_KEYS);

export function isTopicKey(value: string): value is TopicKey {
  return TOPIC_SET.has(value);
}

export function getTopicLabel(topic: string, t: TFunction): string {
  const key = `discover.topics.${topic}`;
  const label = t(key);
  return label === key ? topic : label;
}
