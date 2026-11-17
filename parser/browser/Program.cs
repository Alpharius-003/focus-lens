using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

public class Program { public static void Main() {} }
[SupportedOSPlatform("browser")]
public static partial class BrowserBridge {
    private static byte[]? input;
    [JSExport] public static void Allocate(int length) { input = new byte[length]; }
    [JSExport] [return: JSMarshalAs<JSType.MemoryView>()]
    public static ArraySegment<byte> Input() => new(input ?? throw new InvalidOperationException("Missing input"));
    [JSExport] public static async Task<string> Parse(string name,string hash) {
        try { return await ReplayParser.Parse(input ?? throw new InvalidOperationException("Missing input"),name,hash); }
        finally { input=null; }
    }
    [JSImport("records", "focus-lens")] public static partial void Records(string lines);
    [JSImport("progress", "focus-lens")] public static partial void Progress(int value);
}
