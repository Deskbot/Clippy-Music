import * as cp from "child_process";
import * as opt from "../options";

export function doWhenMusicPlays(musicProc: cp.ChildProcessWithoutNullStreams, act: () => void) {
    const maybeAct = (buf: any) => {
        // we want to play the image after the video has appeared, which takes a long time when the video is remote
        // so we have to check the output of the mpv process for when it creates a window

        // Example mpv output. The lines beginning with square brackets only appear with `--msg-level=all=v`, which Clippy is not using.
        // ...
        // (+) Video --vid=1 (*) (h264 1920x1080 60.000fps)
        // (+) Audio --aid=1 --alang=eng (*) (opus 2ch 48000Hz)
        // [vo/gpu] Probing for best GPU context.
        // [vo/gpu/opengl] Initializing GPU context 'wayland'
        // [vo/gpu/opengl] Initializing GPU context 'x11egl'
        // [vo/gpu/x11] X11 opening display: :0
        // [vo/gpu/x11] X11 running at 2560x1440 (":0" => local display)
        // ...
        // AO: [pulse] 48000Hz stereo 2ch float
        // ...
        // VO: [gpu] 1920x1080 yuv420p
        // ...
        if (buf.includes("AO") || buf.includes("VO")) {
            act();
            musicProc.stdout.removeListener("data", maybeAct); //make sure we only check for this once, for efficiency
        }
    };
    musicProc.stdout.on("data", maybeAct);
}

export function startImageOverlay(path: string, duration: number): cp.ChildProcessWithoutNullStreams {
    return cp.spawn("timeout", [duration + "s", opt.showImageCommand, path, ...opt.showImageArgs]);
}

export function startMusic(path: string, duration: number, startTime: number | null | undefined, endTime: number | null | undefined) {
    const args = [duration + "s", opt.mpvCommand, ...opt.mpvArgs, "--quiet", path];

    if (startTime) {
        args.push("--start");
        args.push(startTime.toString());
    }

    if (endTime) {
        args.push("--end");
        args.push(endTime.toString());
    }

    if (opt.mute.get()) {
        args.push("--mute=yes");
    }

    return cp.spawn("timeout", args);
}

export function startVideoOverlay(path: string, duration: number): cp.ChildProcessWithoutNullStreams {
    return cp.spawn("timeout", [duration + "s", opt.mpvCommand, path, ...opt.mpvArgs, "--loop-file=inf", "--mute=yes"]);
}

