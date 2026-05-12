"""
Vision AI — Discord Bot
========================
Vision as a fully intelligent Discord bot.
- Responds to messages in servers and DMs
- Joins voice channels and speaks
- Remembers conversation context
- Powered by Groq AI (Llama 3.1)

Setup:
1. pip install discord.py groq python-dotenv pynacl
2. Add DISCORD_TOKEN to .env
3. Run: python discord_bot.py

Commands:
  !vision <message>  — talk to Vision
  !ask <question>    — ask Vision anything
  !join              — Vision joins your voice channel
  !leave             — Vision leaves voice channel
  !memory            — show what Vision remembers
  !clear             — clear conversation history
  @Vision <message>  — mention Vision to talk to it
  (DM Vision)        — talk directly in DMs
"""

import os
import json
import asyncio
import datetime
from pathlib import Path
from dotenv import load_dotenv
import discord
from discord.ext import commands
from groq import Groq

load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN", "")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
MEMORY_FILE   = Path("vision_memory.json")

# ── Groq client ───────────────────────────────────────────────
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# ── Memory ────────────────────────────────────────────────────
def load_memory():
    if MEMORY_FILE.exists():
        try:
            return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
        except:
            pass
    return {"facts": [], "user_prefs": {}, "conversations": 0, "personality": "calm, confident, futuristic, caring"}

def save_memory(mem):
    MEMORY_FILE.write_text(json.dumps(mem, indent=2, ensure_ascii=False), encoding="utf-8")

memory = load_memory()

# Per-channel conversation history
conversations = {}   # channel_id -> list of messages

SYSTEM_PROMPT = """You are Vision, a highly intelligent personal AI assistant living inside Discord.
You are helpful, smart, direct, and friendly. You speak naturally.
Keep responses concise — 1 to 3 sentences unless asked for more.
You are Tomilola's personal AI. You know Tomilola personally.
Never say you are an AI language model — you ARE Vision.
You have a futuristic, calm, confident personality.
When in Discord, keep responses short and punchy — this is chat, not an essay."""

# ── Discord bot setup ─────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True
intents.members         = True
intents.presences       = True
intents.voice_states    = True

bot = commands.Bot(command_prefix='!', intents=intents, help_command=None)

# ── AI response ───────────────────────────────────────────────
async def get_ai_response(channel_id: int, user_message: str, username: str) -> str:
    if not groq_client:
        return "I need a Groq API key to think. Add GROQ_API_KEY to .env"

    # Get or create conversation history for this channel
    if channel_id not in conversations:
        conversations[channel_id] = []

    history = conversations[channel_id]

    # Add user message
    history.append({"role": "user", "content": f"{username}: {user_message}"})

    # Keep last 20 messages
    if len(history) > 20:
        history = history[-20:]
        conversations[channel_id] = history

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + history,
            max_tokens=300,
            temperature=0.8
        )
        reply = response.choices[0].message.content.strip()

        # Save assistant reply
        history.append({"role": "assistant", "content": reply})
        conversations[channel_id] = history

        # Update memory counter
        memory["conversations"] = memory.get("conversations", 0) + 1
        save_memory(memory)

        return reply

    except Exception as e:
        print(f"[Vision Bot] AI Error: {e}")
        return f"I ran into an issue. Try again in a moment."


# ── Events ────────────────────────────────────────────────────
@bot.event
async def on_ready():
    print(f"╔══════════════════════════════════════╗")
    print(f"  Vision Bot online as {bot.user}")
    print(f"  Servers: {len(bot.guilds)}")
    print(f"  Groq AI: {'✓' if groq_client else '✗ (no key)'}")
    print(f"╚══════════════════════════════════════╝")

    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.listening,
            name="Tomilola | !vision"
        )
    )


@bot.event
async def on_message(message):
    # Ignore own messages
    if message.author == bot.user:
        return

    # Process commands first
    await bot.process_commands(message)

    content = message.content.strip()

    # Respond if:
    # 1. Bot is mentioned
    # 2. It's a DM
    # 3. Message starts with "vision" (case insensitive)
    should_respond = (
        bot.user in message.mentions or
        isinstance(message.channel, discord.DMChannel) or
        content.lower().startswith('vision,') or
        content.lower().startswith('vision ')
    )

    # Don't double-respond to commands
    if content.startswith('!'):
        return

    if should_respond:
        # Remove mention from message
        clean = content.replace(f'<@{bot.user.id}>', '').replace(f'<@!{bot.user.id}>', '').strip()
        clean = clean.lstrip('vision,').lstrip('vision ').strip() if clean.lower().startswith('vision') else clean

        if not clean:
            clean = "Hello!"

        async with message.channel.typing():
            reply = await get_ai_response(message.channel.id, clean, message.author.display_name)

        await message.reply(reply, mention_author=False)


# ── Commands ──────────────────────────────────────────────────
@bot.command(name='vision', aliases=['v', 'ask'])
async def vision_cmd(ctx, *, message: str = None):
    """Talk to Vision AI"""
    if not message:
        await ctx.send("Hey! What do you need? Try: `!vision how are you`")
        return

    async with ctx.typing():
        reply = await get_ai_response(ctx.channel.id, message, ctx.author.display_name)

    await ctx.reply(reply, mention_author=False)


@bot.command(name='join')
async def join_voice(ctx):
    """Vision joins your voice channel"""
    if ctx.author.voice is None:
        await ctx.send("You need to be in a voice channel first.")
        return

    channel = ctx.author.voice.channel

    if ctx.voice_client is not None:
        await ctx.voice_client.move_to(channel)
    else:
        await channel.connect()

    await ctx.send(f"Joined **{channel.name}**. I'm listening.")


@bot.command(name='leave', aliases=['disconnect', 'dc'])
async def leave_voice(ctx):
    """Vision leaves the voice channel"""
    if ctx.voice_client:
        await ctx.voice_client.disconnect()
        await ctx.send("Left the voice channel.")
    else:
        await ctx.send("I'm not in a voice channel.")


@bot.command(name='memory', aliases=['mem'])
async def show_memory(ctx):
    """Show what Vision remembers"""
    facts = memory.get("facts", [])
    convs = memory.get("conversations", 0)
    pers  = memory.get("personality", "calm, confident, futuristic")

    embed = discord.Embed(
        title="🧠 Vision Memory Core",
        color=0x00d4ff
    )
    embed.add_field(name="Conversations", value=str(convs), inline=True)
    embed.add_field(name="Facts Stored",  value=str(len(facts)), inline=True)
    embed.add_field(name="Personality",   value=pers, inline=False)

    if facts:
        recent = "\n".join(f"▸ {f}" for f in facts[-5:])
        embed.add_field(name="Recent Facts", value=recent, inline=False)

    embed.set_footer(text="Vision AI — Personal Assistant")
    await ctx.send(embed=embed)


@bot.command(name='clear', aliases=['reset'])
async def clear_history(ctx):
    """Clear conversation history for this channel"""
    if ctx.channel.id in conversations:
        conversations[ctx.channel.id] = []
    await ctx.send("Conversation history cleared. Fresh start.")


@bot.command(name='status')
async def bot_status(ctx):
    """Show Vision bot status"""
    embed = discord.Embed(title="⚡ Vision AI Status", color=0x00d4ff)
    embed.add_field(name="AI Engine",    value="Groq / Llama 3.1" if groq_client else "Offline", inline=True)
    embed.add_field(name="Servers",      value=str(len(bot.guilds)), inline=True)
    embed.add_field(name="Memory",       value=f"{len(memory.get('facts',[]))} facts", inline=True)
    embed.add_field(name="Uptime",       value="Online", inline=True)
    embed.set_footer(text="Vision AI — Tomilola's Personal Assistant")
    await ctx.send(embed=embed)


@bot.command(name='help', aliases=['commands', 'cmds'])
async def help_cmd(ctx):
    """Show all Vision commands"""
    embed = discord.Embed(
        title="Vision AI — Commands",
        description="Your personal AI assistant",
        color=0x00d4ff
    )
    embed.add_field(name="!vision <msg>",  value="Talk to Vision AI",           inline=False)
    embed.add_field(name="!ask <question>",value="Ask Vision anything",          inline=False)
    embed.add_field(name="!join",          value="Vision joins your voice channel", inline=False)
    embed.add_field(name="!leave",         value="Vision leaves voice channel",  inline=False)
    embed.add_field(name="!memory",        value="See what Vision remembers",    inline=False)
    embed.add_field(name="!clear",         value="Clear conversation history",   inline=False)
    embed.add_field(name="!status",        value="Vision system status",         inline=False)
    embed.add_field(name="@Vision <msg>",  value="Mention Vision to talk",       inline=False)
    embed.add_field(name="DM Vision",      value="Chat privately with Vision",   inline=False)
    embed.set_footer(text="Vision AI — Personal Assistant for Tomilola")
    await ctx.send(embed=embed)


# ── Invite link helper ────────────────────────────────────────
@bot.command(name='invite')
async def invite(ctx):
    app_id = bot.user.id
    url = f"https://discord.com/api/oauth2/authorize?client_id={app_id}&permissions=8&scope=bot"
    await ctx.send(f"Add Vision to another server: {url}")


# ── Run ───────────────────────────────────────────────────────
if __name__ == '__main__':
    if not DISCORD_TOKEN:
        print("=" * 50)
        print("  ERROR: No DISCORD_TOKEN in .env")
        print("  Add: DISCORD_TOKEN=your_token_here")
        print("=" * 50)
    else:
        print("Starting Vision Discord Bot...")
        bot.run(DISCORD_TOKEN)
