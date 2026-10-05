using System.Runtime.InteropServices.JavaScript;

public static partial class VineBridge
{
    public static void Main() { }

    [JSExport]
    public static string Run(string request) => Angouri.Kernel.Game.Run(request);
}
