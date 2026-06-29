// PORTED VERBATIM from 1click1story inline-0.js — turns raw model text into structured scenes.
// Multi-format tolerant (A/B/C layouts + fallbacks). sceneTemplates fills empty actions.

import { sceneTemplates } from "./data";

function extractPromptContent(rawText) {
    if (!rawText) return '';
    let s = rawText;
    // Convert literal \n to actual newlines and \" to "
    s = s.replace(/\\n/g, '\n');
    s = s.replace(/\\"/g, '"');
    // Strip code block markers (``` or ```lang)
    s = s.replace(/```[\w]*\r?\n?/g, '').replace(/```/g, '');
    // Strip bold markers
    s = s.replace(/\*\*/g, '');
    // Split lines (handle both \n and \r\n)
    const lines = s.split(/\r?\n/);
    const content = [];
    let started = false;
    for (const line of lines) {
        const t = line.trim();
        if (!started) {
            if (!t) continue;
            if (t.startsWith('(')) continue;
            if (t.startsWith('👉')) continue;
            // Skip emoji header lines containing 🔴 or 🟢
            if (t.includes('🔴') || t.includes('🟢')) continue;
            // Skip section header lines like "1. สร้างรูป..." or "2. สร้างวิดีโอ..."
            if (/^\d+\.\s/.test(t) && (/สร้าง|GEN\s/i.test(t))) continue;
            // Skip "Plaintext" label from code blocks
            if (t.toLowerCase() === 'plaintext') continue;
            started = true;
        }
        if (started) content.push(line);
    }
    return content.join('\n').trim();
}

function parseGeminiResponse(text) {
    const scenes = [];
    
    // ===== FORMAT C: Multi-turn format =====
    // **Scene X - ชื่อฉาก** หรือ **Scene X: ชื่อฉาก** หรือ Scene X (ชื่อฉาก):
    const multiTurnRegex = /(?:\*\*)?Scene\s+(\d+)\s*[-:(]\s*(.+?)(?:\*\*|\)|:)\s*:?\s*\n([\s\S]*?)(?=(?:\*\*)?Scene\s+\d+\s*[-:(]|---CAPTION_START---|---HASHTAG_START---|$)/gi;
    let multiMatch;
    while ((multiMatch = multiTurnRegex.exec(text)) !== null) {
        const sceneNum = parseInt(multiMatch[1]);
        const sceneName = multiMatch[2].trim();
        const block = multiMatch[3];
        
        // Extract Speaker, Dialogue, Action from block
        const speakerMatch = block.match(/\*?\s*Speaker:\s*\*?\s*(.+?)(?:\n|$)/i);
        const dialogueMatch = block.match(/\*?\s*Dialogue:\s*\*?\s*"?(.+?)"?\s*(?:\n|$)/i);
        const actionMatch = block.match(/(?:-\s*)?(?:\*\*)?Action(?:\*\*)?[:\s]+(?!-\s*$)(.+?)(?:\n|$)/i);
        
        const speaker = speakerMatch ? speakerMatch[1].trim() : '';
        const dialogue = dialogueMatch ? dialogueMatch[1].trim().replace(/^"|"$/g, '') : '';
        let action = actionMatch ? actionMatch[1].trim().replace(/\n\s*\*/g, ' ').replace(/\s+/g, ' ') : '';
        // ถ้า Action เป็น "-" หรือ "N/A" ให้ถือว่าว่าง
        if (action === '-' || action === 'N/A' || action === 'n/a') action = '';
        
        // ดึง Image/Video Prompt จาก code block ใน block (ถ้ามี)
        const imgMarker = block.search(/🔴|สร้างรูป|GEN\s*IMAGE/i);
        const vidMarker = block.search(/🟢|สร้างวิดีโอ|GEN\s*VIDEO/i);
        let imgText = '', vidText = '';
        if (imgMarker >= 0 && vidMarker > imgMarker) {
            imgText = block.substring(imgMarker, vidMarker);
            vidText = block.substring(vidMarker);
        } else if (imgMarker >= 0) {
            imgText = block.substring(imgMarker);
        } else if (vidMarker >= 0) {
            vidText = block.substring(vidMarker);
        }
        const imagePrompt = extractPromptContent(imgText);
        const videoPrompt = extractPromptContent(vidText);
        
        scenes.push({
            scene_number: sceneNum,
            scene_name: sceneName,
            picture_ref: '',
            tag: sceneNum === 1 ? 'HOOK' : '',
            speaker: speaker,
            dialogue: dialogue,
            action: action,
            image_prompt: imagePrompt || `Scene ${sceneNum}: ${sceneName} - ${action}`,
            video_prompt: videoPrompt || `Scene ${sceneNum}: ${sceneName} - Speaker: ${speaker}, Dialogue: "${dialogue}", Action: ${action}`
        });
    }
    
    // If Multi-turn format found scenes BUT no real prompts, try Format A/B too
    // (Format C อาจจับ scene ได้แต่ไม่มี code block prompt)
    const hasRealPrompts = scenes.some(s => s.image_prompt && !s.image_prompt.startsWith('Scene '));
    if (scenes.length > 0 && hasRealPrompts) {
        // Parse Caption + Hashtag ก่อน return
        let earlyCaption = '';
        const earlyCaptionMatch = text.match(/---CAPTION_START---([\s\S]*?)---CAPTION_END---/i);
        if (earlyCaptionMatch) earlyCaption = earlyCaptionMatch[1].trim();
        
        let earlyHashtags = '';
        const earlyHashtagMatch = text.match(/---HASHTAG_START---([\s\S]*?)---HASHTAG_END---/i);
        if (earlyHashtagMatch) earlyHashtags = earlyHashtagMatch[1].trim();
        
        return { scenes, tips: '', rawText: text, caption: earlyCaption, hashtags: earlyHashtags };
    }
    // ถ้า Format C จับได้แต่ไม่มี real prompt → ลอง Format A/B ด้วย
    const multiTurnScenes = [...scenes];
    scenes.length = 0; // reset เพื่อลอง Format A/B
    
    // ===== FORMAT A/B: Original format =====
    // Parse each SCENE block — supports both formats:
    // Format A (Pixar3D): SCENE X : Name \n (Picture Ref: ...) \n ===
    // Format B (Review):  SCENE X : Name \n ===
    // Format C (Follow-up): =========\nSCENE X : Name\n(Picture Ref: ...)\n=========
    const sceneBlockRegex = /={3,}\s*\n?SCENE\s+(\d+)\s*:\s*(.+?)\n(?:\(Picture Ref:\s*(.+?)\)\s*\n)?(?:={3,}\s*\n?)?([\s\S]*?)(?=\n={3,}\s*\n?SCENE|\n-{3,}\n💡|---CAPTION_START---|---HASHTAG_START---|$)/gi;
    let match;
    while ((match = sceneBlockRegex.exec(text)) !== null) {
        const sceneNum = parseInt(match[1]);
        const sceneName = match[2].trim();
        const pictureRef = (match[3] || '').trim();
        const block = match[4];

        // Split block into image section and video section
        // Use flexible markers: 🔴 or "สร้างรูป" or "GEN IMAGE"
        // and 🟢 or "สร้างวิดีโอ" or "GEN VIDEO"
        const imgMarker = block.search(/🔴|สร้างรูป|GEN\s*IMAGE/i);
        const vidMarker = block.search(/🟢|สร้างวิดีโอ|GEN\s*VIDEO/i);

        let imgText = '', vidText = '';
        if (imgMarker >= 0 && vidMarker > imgMarker) {
            imgText = block.substring(imgMarker, vidMarker);
            vidText = block.substring(vidMarker);
        } else if (imgMarker >= 0) {
            imgText = block.substring(imgMarker);
        } else if (vidMarker >= 0) {
            vidText = block.substring(vidMarker);
        }

        const imagePrompt = extractPromptContent(imgText);
        const videoPrompt = extractPromptContent(vidText);

        // ดึง Speaker, Dialogue, Action จาก block (ก่อน Image Prompt)
        const speakerMatch = block.match(/Speaker:\s*\[?(.+?)\]?\s*(?:\n|$)/i);
        const dialogueMatch = block.match(/Dialogue:\s*"?(.+?)"?\s*(?:\n|$)/i);
        const actionMatch = block.match(/Action:\s*\[?(.+?)\]?\s*(?=\n\n|\n🔴|\nGEN IMAGE|$)/i);
        
        const speaker = speakerMatch ? speakerMatch[1].trim().replace(/^\[|\]$/g, '') : '';
        const dialogue = dialogueMatch ? dialogueMatch[1].trim().replace(/^"|"$/g, '') : '';
        const action = actionMatch ? actionMatch[1].trim().replace(/^\[|\]$/g, '') : '';
        
        // Fallback: ดึง Dialogue จาก Video Prompt ถ้า Storyboard section ไม่มี
        let finalDialogue = dialogue;
        let finalAction = action;
        let finalSpeaker = speaker;
        
        if (!finalDialogue || finalDialogue === '-' || finalDialogue === 'N/A') {
            // ดึง Dialogue จาก Video Prompt: "The character speaks...dialogue: "..."" 
            const vidDialogueMatch = videoPrompt.match(/(?:speaks|dialogue)[^"]*"([^"]{10,})"/i);
            if (vidDialogueMatch) {
                finalDialogue = vidDialogueMatch[1].trim();
                console.log(`[Scene ${sceneNum}] Extracted dialogue from Video Prompt: "${finalDialogue.substring(0,50)}"`);
            }
        }
        
        if (!finalSpeaker) {
            const vidSpeakerMatch = videoPrompt.match(/Speaker:\s*(.+?)(?:\n|$)/i);
            if (vidSpeakerMatch) finalSpeaker = vidSpeakerMatch[1].trim();
        }

        scenes.push({
            scene_number: sceneNum,
            scene_name: sceneName,
            picture_ref: pictureRef,
            tag: sceneNum === 1 ? 'HOOK' : (sceneNum === 7 ? 'SELL' : (sceneNum === 8 ? 'CLOSE' : '')),
            speaker: finalSpeaker,
            dialogue: finalDialogue,
            action: finalAction,
            image_prompt: imagePrompt,
            video_prompt: videoPrompt
        });
    }

    // Parse storyboard section for speaker/dialogue/action
    // More flexible regex to handle various formats
    const storyRegex = /Scene\s+(\d+)[^\n]*\n(?:[-=]*\n)?[\s\S]*?(?:-\s*)?Speaker:\s*\[?(.+?)\]?\s*\n[\s\S]*?(?:-\s*)?Dialogue:\s*"?(.+?)"?\s*\n[\s\S]*?(?:-\s*)?Action:\s*\[?(.+?)\]?(?=\n\n|\nScene\s+\d|\n-{3,}|\n={3,}|$)/gi;
    let storyMatch;
    while ((storyMatch = storyRegex.exec(text)) !== null) {
        const num = parseInt(storyMatch[1]);
        const scene = scenes.find(s => s.scene_number === num);
        if (scene) {
            const sp = storyMatch[2].trim().replace(/^\[|\]$/g, '');
            const dl = storyMatch[3].trim().replace(/^"|"$/g, '');
            const ac = storyMatch[4].trim().replace(/^\[|\]$/g, '');
            if (sp) scene.speaker = sp;
            if (dl && dl !== 'N/A') scene.dialogue = dl;
            if (ac && ac !== 'N/A') scene.action = ac;
        }
    }
    
    // Fallback: try to parse from FULL STORYBOARD section with simpler pattern
    if (scenes.some(s => !s.dialogue)) {
        const simpleStoryRegex = /Scene\s+(\d+)[^:]*:?\s*\n[-\s]*Speaker:\s*(.+?)\n[-\s]*Dialogue:\s*"?([^"]+)"?\s*\n[-\s]*Action:\s*(.+?)(?=\nScene\s+\d|\n-{3,}|\n={3,}|Video Type:|$)/gis;
        let simpleMatch;
        while ((simpleMatch = simpleStoryRegex.exec(text)) !== null) {
            const num = parseInt(simpleMatch[1]);
            const scene = scenes.find(s => s.scene_number === num);
            if (scene && (!scene.dialogue || scene.dialogue === 'N/A')) {
                const sp = simpleMatch[2].trim().replace(/^\[|\]$/g, '');
                const dl = simpleMatch[3].trim().replace(/^"|"$/g, '');
                const ac = simpleMatch[4].trim().replace(/^\[|\]$/g, '');
                if (sp) scene.speaker = sp;
                if (dl && dl !== 'N/A') scene.dialogue = dl;
                if (ac && ac !== 'N/A') scene.action = ac;
            }
        }
    }
    
    // Fallback 2: Ultra-flexible line-by-line parsing for Storyboard section
    // ทำงานเสมอถ้ามี scene ที่ dialogue ว่างหรือเป็น N/A
    if (scenes.some(s => !s.dialogue || s.dialogue === 'N/A' || s.dialogue === '-' || s.dialogue === '')) {
        console.log('[parseGeminiResponse] Trying ultra-flexible Storyboard parsing...');
        const lines = text.split('\n');
        let currentSceneNum = null;
        let currentSpeaker = '';
        let currentDialogue = '';
        let currentAction = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Match "Scene X" header
            const sceneHeaderMatch = line.match(/^Scene\s+(\d+)/i);
            if (sceneHeaderMatch) {
                // Save previous scene data
                if (currentSceneNum !== null && currentDialogue) {
                    const prevScene = scenes.find(s => s.scene_number === currentSceneNum);
                    if (prevScene && (!prevScene.dialogue || prevScene.dialogue === 'N/A' || prevScene.dialogue === '-' || prevScene.dialogue === '')) {
                        if (currentSpeaker) prevScene.speaker = currentSpeaker;
                        if (currentDialogue && currentDialogue !== 'N/A') prevScene.dialogue = currentDialogue;
                        if (currentAction && currentAction !== 'N/A') prevScene.action = currentAction;
                        console.log(`[Fallback2] Updated Scene ${currentSceneNum}: speaker="${currentSpeaker}" dialogue="${currentDialogue.substring(0,50)}"`);
                    }
                }
                currentSceneNum = parseInt(sceneHeaderMatch[1]);
                currentSpeaker = '';
                currentDialogue = '';
                currentAction = '';
                continue;
            }
            
            // Match Speaker/Dialogue/Action lines
            const speakerLine = line.match(/^-?\s*Speaker:\s*(.+)/i);
            const dialogueLine = line.match(/^-?\s*Dialogue:\s*"?(.+?)"?\s*$/i);
            const actionLine = line.match(/^-?\s*Action:\s*(.+)/i);
            
            if (speakerLine) currentSpeaker = speakerLine[1].trim();
            if (dialogueLine) currentDialogue = dialogueLine[1].trim().replace(/^"|"$/g, '');
            if (actionLine) currentAction = actionLine[1].trim();
        }
        
        // Save last scene
        if (currentSceneNum !== null && currentDialogue) {
            const lastScene = scenes.find(s => s.scene_number === currentSceneNum);
            if (lastScene && (!lastScene.dialogue || lastScene.dialogue === 'N/A' || lastScene.dialogue === '-' || lastScene.dialogue === '')) {
                if (currentSpeaker) lastScene.speaker = currentSpeaker;
                if (currentDialogue && currentDialogue !== 'N/A') lastScene.dialogue = currentDialogue;
                if (currentAction && currentAction !== 'N/A') lastScene.action = currentAction;
                console.log(`[Fallback2] Updated Scene ${currentSceneNum}: speaker="${currentSpeaker}" dialogue="${currentDialogue.substring(0,50)}"`);
            }
        }
    }

    // ถ้า Format A/B ไม่เจอ scene แต่ multiTurnScenes มี → ใช้ multiTurnScenes
    if (scenes.length === 0 && multiTurnScenes.length > 0) {
        console.log(`[parseGeminiResponse] Format A/B found 0 scenes, using ${multiTurnScenes.length} scenes from Format C`);
        scenes.push(...multiTurnScenes);
    }
    // ถ้า Format A/B เจอ scene → merge dialogue จาก multiTurnScenes (ถ้ามี)
    if (scenes.length > 0 && multiTurnScenes.length > 0) {
        for (const mtScene of multiTurnScenes) {
            const scene = scenes.find(s => s.scene_number === mtScene.scene_number);
            if (scene) {
                if (!scene.speaker && mtScene.speaker) scene.speaker = mtScene.speaker;
                if ((!scene.dialogue || scene.dialogue === '' || scene.dialogue === '-') && mtScene.dialogue) scene.dialogue = mtScene.dialogue;
                if ((!scene.action || scene.action === '' || scene.action === '-') && mtScene.action) scene.action = mtScene.action;
            }
        }
    }

    // Fallback 3: Fill empty action with sceneTemplate defaults
    for (const scene of scenes) {
        if (!scene.action || scene.action === '-' || scene.action === '' || scene.action === 'N/A') {
            const tmpl = sceneTemplates[scene.scene_number] || sceneTemplates[2];
            if (tmpl && tmpl.action) {
                scene.action = tmpl.action;
                console.log(`[Fallback3] Scene ${scene.scene_number}: action was empty, using template: "${tmpl.action}"`);
            }
        }
    }

    // Extract Director's Tips
    let tips = '';
    const tipsMatch = text.match(/💡\s*DIRECTOR'?S?\s*TIPS[\s\S]*$/i);
    if (tipsMatch) tips = tipsMatch[0].trim();

    // Extract Caption from ---CAPTION_START--- / ---CAPTION_END---
    let caption = '';
    const captionMatch = text.match(/---CAPTION_START---([\s\S]*?)---CAPTION_END---/i);
    if (captionMatch) {
        caption = captionMatch[1].trim();
        console.log('[parseGeminiResponse] Extracted caption:', caption.substring(0, 100));
    }

    // Extract Hashtag from ---HASHTAG_START--- / ---HASHTAG_END---
    let hashtags = '';
    const hashtagMatch = text.match(/---HASHTAG_START---([\s\S]*?)---HASHTAG_END---/i);
    if (hashtagMatch) {
        hashtags = hashtagMatch[1].trim();
        console.log('[parseGeminiResponse] Extracted hashtags:', hashtags.substring(0, 100));
    }

    // Extract STORYBOARD OVERVIEW from raw text
    let storyboardOverview = '';
    const overviewMatch = text.match(/🎬\s*STORYBOARD OVERVIEW[\s\S]*?(?=FULL STORYBOARD|Scene\s+1\s|={3,}\s*\n?SCENE)/i);
    if (overviewMatch) {
        storyboardOverview = overviewMatch[0].trim();
    }

    return { scenes, tips, rawText: text, storyboardOverview, caption, hashtags };
}

export { parseGeminiResponse, extractPromptContent };
