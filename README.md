# scratch-pseudocode

A command-line utility for generating pseudocode from public [MIT Scratch](https://scratch.mit.edu/) projects. 
I created this tool to experiment with AI feedback generation for student Scratch projects, tuned for Anthropic Claude.

Given a project URL, it fetches the project and prints each sprite's variables, lists, costumes, and scripts in Python-style pseudocode.
This is especially useful for sending Scratch projects to AI agents for analysis, reading through project logic without opening the editor, or for diffing and reviewing projects in plain text.
This package is based on the library I made for [MixGit](https://github.com/HunterCogan/mixgit), where I used pseudocode to reduce input tokens by [__87%__](https://github.com/HunterCogan/mixgit/pull/55).

Rewritten with simplicity in mind and to work with zero runtime dependencies.

## Install

Run in the command-line:

```
npx scratch-pseudocode https://scratch.mit.edu/projects/1327031806
```

It can be installed globally:

```
npm install -g scratch-pseudocode
scratch-pseudocode https://scratch.mit.edu/projects/847915138
```

Requires Node.js 20 or later.

## Usage

```
scratch-pseudocode [-t <name>]... <url>
```

The Scratch project URL must contain a project ID, and the project must be public and shared. Path segments are accepted:

```
scratch-pseudocode https://scratch.mit.edu/projects/847915138/editor/
```

### Options

Include `-t, --target <name>` to only output the named target. Repeat the flag to include multiple:

```
scratch-pseudocode -t Stage https://scratch.mit.edu/projects/1218216947
```

When excluded, all targets are printed.

## Demo

Redirect output to a text file and read a snippet:

```
scratch-pseudocode -t Stage -t plane https://scratch.mit.edu/projects/847915138 > pseudocode.txt
head -n 20 pseudocode.txt
```

### Output

```
Target: `Stage`
Variables: [SCORE=`156`, SPEED=`1`, ☁ HIGHSCORE=`1953`]
Costumes: [`backdrop1`]
event_whenflagclicked():
        event_broadcast(BROADCAST_INPUT=`home screen`)
        control_forever():
                sound_playuntildone(`What What?! Wowow!`)

Target: `plane`
Variables: [gravity=`-21.260000000000005`]
Costumes: [`costume1`]
event_whenbroadcastreceived(BROADCAST_OPTION=`play game`):
        data_setvariableto(VARIABLE=`SCORE`, VALUE=`0`)
        data_setvariableto(VARIABLE=`SPEED`, VALUE=`0`)
        data_setvariableto(VARIABLE=`gravity`, VALUE=`0`)
        motion_gotoxy(X=`-70`, Y=`0`)
        looks_show()
        control_forever():
                motion_changeyby(DY=(`0.06` * (sensing_mousey() - motion_yposition())))
                motion_pointindirection(DIRECTION=(((motion_yposition() - sensing_mousey()) / `9`) + `90`))
```

Each target begins with a header containing local variables, lists, and costumes.
Then, scripts are shown block-by-block.

Most of the blocks are rendered with the code, inputs, and fields from the fetched `project.json`.
Procedures, operators, and shadow blocks are an exception, restructured for readability.
In the above example, you can see that `operator_subtract(NUM1=motion_yposition(), NUM2=sensing_mousey())` was simplified to `(motion_yposition() - sensing_mousey())`.
These choices were made to improve Anthropic Claude's comprehension of student projects; I plan to add more output options soon!
