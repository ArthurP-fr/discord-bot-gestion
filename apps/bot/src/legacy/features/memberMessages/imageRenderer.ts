import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

import type { MemberMessageImageInput } from "../../types/memberMessages.js";

const CARD_WIDTH = 1024;
const CARD_HEIGHT = 320;
const AVATAR_SIZE = 220;
const AVATAR_X = 42;
const AVATAR_Y = (CARD_HEIGHT - AVATAR_SIZE) / 2;
const TEXT_X = AVATAR_X + AVATAR_SIZE + 56;
const TEXT_MAX_WIDTH = CARD_WIDTH - TEXT_X - 36;
const FONT_FAMILY = '"DejaVu Sans", sans-serif';

const fitFontSize = (
  context: SKRSContext2D,
  text: string,
  startSize: number,
  minSize: number,
  maxWidth: number,
  fontWeight = 700,
): number => {
  let size = startSize;

  while (size > minSize) {
    context.font = `${fontWeight} ${size}px ${FONT_FAMILY}`;
    if (context.measureText(text).width <= maxWidth) {
      break;
    }

    size -= 2;
  }

  return size;
};

const wrapText = (
  context: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] => {
  const words = text.trim().split(/\s+/g).filter((value) => value.length > 0);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (context.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = "";
    }

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (lines.length < maxLines && current.length > 0) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  const lastLine = lines[maxLines - 1];
  if (lastLine && lines.length === maxLines) {
    let value = lastLine;
    while (context.measureText(`${value}...`).width > maxWidth && value.length > 0) {
      value = value.slice(0, -1);
    }

    lines[maxLines - 1] = value.length === lastLine.length ? value : `${value}...`;
  }

  return lines;
};

const drawAvatar = async (
  context: SKRSContext2D,
  username: string,
  avatarUrl: string,
): Promise<void> => {
  context.fillStyle = "#1f2937";
  context.beginPath();
  context.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
  context.closePath();
  context.fill();

  try {
    const avatar = await loadImage(avatarUrl);
    context.save();
    context.beginPath();
    context.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
    context.restore();
  } catch {
    const initial = username.trim().charAt(0).toUpperCase() || "?";
    context.fillStyle = "#f8fafc";
    context.font = `700 92px ${FONT_FAMILY}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initial, AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
  }

  context.strokeStyle = "rgba(248, 250, 252, 0.9)";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, AVATAR_SIZE / 2 - 3, 0, Math.PI * 2);
  context.closePath();
  context.stroke();
};

export const renderMemberMessageImage = async (input: MemberMessageImageInput): Promise<Buffer> => {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (input.kind === "welcome") {
    gradient.addColorStop(0, "#2b303b");
    gradient.addColorStop(1, "#1e232d");
  } else {
    gradient.addColorStop(0, "#36252a");
    gradient.addColorStop(1, "#241b21");
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  context.globalAlpha = 0.14;
  context.fillStyle = input.kind === "welcome" ? "#93c5fd" : "#fca5a5";
  context.beginPath();
  context.arc(CARD_WIDTH - 110, -20, 220, 0, Math.PI * 2);
  context.closePath();
  context.fill();
  context.globalAlpha = 1;

  await drawAvatar(context, input.username, input.avatarUrl);

  const headlineSize = fitFontSize(context, input.title, 84, 52, TEXT_MAX_WIDTH, 700);
  context.font = `700 ${headlineSize}px ${FONT_FAMILY}`;
  context.fillStyle = "#f8fafc";
  context.fillText(input.title, TEXT_X, 116);

  const subtitleSize = fitFontSize(context, input.subtitle, 58, 30, TEXT_MAX_WIDTH, 500);
  context.font = `500 ${subtitleSize}px ${FONT_FAMILY}`;
  context.fillStyle = "#e5e7eb";

  const subtitleLines = wrapText(context, input.subtitle, TEXT_MAX_WIDTH, 2);
  const subtitleStartY = 162;
  const subtitleLineHeight = subtitleSize + 8;
  subtitleLines.forEach((line, index) => {
    context.fillText(line, TEXT_X, subtitleStartY + index * subtitleLineHeight);
  });

  const usernameSize = fitFontSize(context, input.username, 54, 28, TEXT_MAX_WIDTH, 700);
  context.font = `700 ${usernameSize}px ${FONT_FAMILY}`;
  context.fillStyle = input.kind === "welcome" ? "#93c5fd" : "#fda4af";
  context.fillText(input.username, TEXT_X, CARD_HEIGHT - 34);

  return canvas.toBuffer("image/png");
};
