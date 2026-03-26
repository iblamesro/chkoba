// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "Chkoba",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(name: "Chkoba", targets: ["Chkoba"])
    ],
    targets: [
        .target(name: "Chkoba")
    ]
)
