/**
 * The C# source of the Windows window-capture helper, compiled once per machine
 * by `ensureWindowCaptureHelper` with the .NET Framework compiler every Windows
 * 10 install carries.
 *
 * Why native rather than Playwright: the Lab drives a headed Chromium, and a
 * Playwright capture of a tab that is not in front waits out its timeout
 * without a frame. `PrintWindow` with `PW_RENDERFULLCONTENT` asks the window
 * itself for its composed pixels, so it photographs exactly what the person
 * watching sees -- the page, the extension side panel, a docked panel popup
 * and the on-page overlay together -- without activating, raising or focusing
 * anything. Measured on 2026-09-29 against a live Lab Chromium: 0.4 s a frame.
 *
 * `processes` lists the browser processes with their command lines, so the
 * caller can find the one launched on this run's profile directory
 * (`findBrowserProcess`); `capture <pid> <quality>` writes one JPEG of every
 * visible top-level window that process owns to stdout. Exit 2 means the
 * process has no visible window, so a cached process id is stale.
 */
export const WINDOW_CAPTURE_SOURCE = String.raw`
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;

// Usage:
//   window-capture processes            one line per browser process: pid TAB parentPid TAB commandLine
//   window-capture capture <pid> <q>    JPEG of every visible top-level window <pid> owns, composited at
//                                       their screen positions, written to stdout
// Exit 0 on success; 2 when there is nothing to capture; 1 on any other failure (message on stderr).
static class WindowCapture {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out int value, int size);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
  const uint PW_RENDERFULLCONTENT = 2;
  const int DWMWA_CLOAKED = 14;
  const int MIN_SIDE = 120;
  const int MAX_WIDTH = 2400;

  static int Main(string[] args) {
    try {
      SetProcessDPIAware();
      if (args.Length == 1 && args[0] == "processes") return Processes();
      if (args.Length == 3 && args[0] == "capture") return Capture(uint.Parse(args[1]), long.Parse(args[2]));
      Console.Error.WriteLine("usage: window-capture processes | capture <pid> <quality>");
      return 1;
    } catch (Exception error) {
      Console.Error.WriteLine(error.GetType().Name + ": " + error.Message);
      return 1;
    }
  }

  static int Processes() {
    var output = new StringBuilder();
    using (var searcher = new ManagementObjectSearcher("SELECT ProcessId, ParentProcessId, CommandLine FROM Win32_Process WHERE Name = 'chrome.exe' OR Name = 'msedge.exe'")) {
      foreach (ManagementObject process in searcher.Get()) {
        var commandLine = (process["CommandLine"] as string ?? "").Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ');
        output.Append(process["ProcessId"]).Append('\t').Append(process["ParentProcessId"]).Append('\t').Append(commandLine).Append('\n');
      }
    }
    var bytes = new UTF8Encoding(false).GetBytes(output.ToString());
    using (var stdout = Console.OpenStandardOutput()) stdout.Write(bytes, 0, bytes.Length);
    return 0;
  }

  static int Capture(uint pid, long quality) {
    var windows = new List<KeyValuePair<IntPtr, RECT>>();
    EnumWindows((hwnd, _) => {
      uint owner;
      GetWindowThreadProcessId(hwnd, out owner);
      if (owner != pid || !IsWindowVisible(hwnd) || IsIconic(hwnd) || GetWindowTextLength(hwnd) == 0) return true;
      int cloaked;
      if (DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out cloaked, 4) == 0 && cloaked != 0) return true;
      RECT rect;
      if (!GetWindowRect(hwnd, out rect) || rect.Right - rect.Left < MIN_SIDE || rect.Bottom - rect.Top < MIN_SIDE) return true;
      windows.Add(new KeyValuePair<IntPtr, RECT>(hwnd, rect));
      return true;
    }, IntPtr.Zero);
    if (windows.Count == 0) { Console.Error.WriteLine("no visible window belongs to process " + pid); return 2; }
    int left = int.MaxValue, top = int.MaxValue, right = int.MinValue, bottom = int.MinValue;
    foreach (var window in windows) {
      left = Math.Min(left, window.Value.Left); top = Math.Min(top, window.Value.Top);
      right = Math.Max(right, window.Value.Right); bottom = Math.Max(bottom, window.Value.Bottom);
    }
    using (var canvas = new Bitmap(right - left, bottom - top, PixelFormat.Format24bppRgb)) {
      using (var graphics = Graphics.FromImage(canvas)) {
        graphics.Clear(Color.FromArgb(32, 32, 32));
        // EnumWindows walks the z-order front to back, so painting in reverse leaves the front window on top.
        for (int index = windows.Count - 1; index >= 0; index -= 1) {
          var rect = windows[index].Value;
          using (var shot = new Bitmap(rect.Right - rect.Left, rect.Bottom - rect.Top, PixelFormat.Format32bppArgb)) {
            using (var shotGraphics = Graphics.FromImage(shot)) {
              var hdc = shotGraphics.GetHdc();
              bool printed;
              try { printed = PrintWindow(windows[index].Key, hdc, PW_RENDERFULLCONTENT); }
              finally { shotGraphics.ReleaseHdc(hdc); }
              if (!printed) { Console.Error.WriteLine("PrintWindow refused a window of process " + pid); return 1; }
            }
            graphics.DrawImageUnscaled(shot, rect.Left - left, rect.Top - top);
          }
        }
      }
      var image = canvas.Width > MAX_WIDTH ? new Bitmap(canvas, MAX_WIDTH, (int)((long)canvas.Height * MAX_WIDTH / canvas.Width)) : canvas;
      try {
        var encoder = Array.Find(ImageCodecInfo.GetImageEncoders(), codec => codec.MimeType == "image/jpeg");
        var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, Math.Max(10L, Math.Min(95L, quality)));
        using (var buffer = new MemoryStream()) {
          image.Save(buffer, encoder, parameters);
          using (var stdout = Console.OpenStandardOutput()) buffer.WriteTo(stdout);
        }
      } finally { if (!ReferenceEquals(image, canvas)) image.Dispose(); }
    }
    return 0;
  }
}
`;
