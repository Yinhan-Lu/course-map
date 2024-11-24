// CourseMap.jsx

import React, { useState, useMemo, useEffect, useRef } from "react";
import programsData from "../data/programs.json";

// Helper function to get course data from department file
const getCourseDetails = (courseNumber) => {
  const dept = courseNumber.split(" ")[0];
  try {
    const deptData = require(`../data/${dept}.json`);
    return deptData.find((course) => course.course_number === courseNumber);
  } catch {
    return null;
  }
};

export default function CourseMap() {
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      const width = window.innerWidth - 48; // 48px for padding
      setContainerWidth(width);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Process program data and prerequisites
  const programStructure = useMemo(() => {
    if (!selectedProgram) return null;

    const program = programsData.find((p) => p.program === selectedProgram);
    if (!program) return null;

    // Get course details including prerequisites
    const coursesWithDetails = program.courses.map((course) => ({
      ...course,
      ...getCourseDetails(course.course_number),
    }));

    // Organize by level
    const levels = {};
    coursesWithDetails.forEach((course) => {
      const level =
        Math.floor(parseInt(course.course_number.split(" ")[1]) / 100) * 100;
      if (!levels[level]) levels[level] = [];
      levels[level].push(course);
    });

    return {
      courses: coursesWithDetails,
      levels,
    };
  }, [selectedProgram]);

  // Calculate node positions and SVG dimensions
  const { nodePositions, svgDimensions } = useMemo(() => {
    if (!programStructure) {
      return { nodePositions: {}, svgDimensions: { width: 1000, height: 800 } };
    }

    const positions = {};
    const levelHeight = 150;
    const nodeWidth = 120;
    const mapWidth = containerWidth * 0.7;
    const verticalNoise = 30; // Maximum vertical offset
    let maxX = 0;
    let maxY = 0;

    Object.entries(programStructure.levels).forEach(
      ([level, courses], levelIndex) => {
        const baseY = levelIndex * levelHeight + 100;
        maxY = Math.max(maxY, baseY + 100);

        courses.forEach((course, index) => {
          // Add random vertical offset
          const randomOffset = (Math.random() - 0.5) * verticalNoise;
          const y = baseY + randomOffset;

          const x =
            (index - (courses.length - 1) / 2) * nodeWidth + mapWidth / 2;
          positions[course.course_number] = { x, y };
          maxX = Math.max(maxX, x + 60);
        });
      }
    );

    return {
      nodePositions: positions,
      svgDimensions: {
        width: Math.max(mapWidth, maxX + 100),
        height: maxY + 100,
      },
    };
  }, [programStructure, containerWidth]);

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      // Left click only
      setIsDragging(true);
      setDragStart({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener("mousemove", handleMouseMove);
      svg.addEventListener("mouseup", handleMouseUp);
      svg.addEventListener("mouseleave", handleMouseUp);

      return () => {
        svg.removeEventListener("mousemove", handleMouseMove);
        svg.removeEventListener("mouseup", handleMouseUp);
        svg.removeEventListener("mouseleave", handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  // Add this before the return statement
  const renderPrerequisiteLines = useMemo(() => {
    if (!programStructure || !nodePositions) return [];

    const lines = [];
    programStructure.courses.forEach((course) => {
      const sourcePos = nodePositions[course.course_number];

      // Skip if course position is not found
      if (!sourcePos) return;

      // Get prerequisites for this course
      if (course.prerequisites) {
        course.prerequisites.forEach((prereq) => {
          const targetPos = nodePositions[prereq];

          // Only draw line if both positions exist
          if (targetPos) {
            lines.push({
              id: `${prereq}-${course.course_number}`,
              source: targetPos,
              target: sourcePos,
            });
          }
        });
      }
    });

    return lines;
  }, [programStructure, nodePositions]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header - Made much smaller and moved to side */}
      <div className="p-2 border-b">
        <h1 className="text-xl font-bold">McGill Course Map</h1>
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="mt-1 p-1 border rounded w-[400px] text-sm" // Made more compact
        >
          <option value="">Select a program...</option>
          {programsData.map((program) => (
            <option key={program.program} value={program.program}>
              {program.program}
            </option>
          ))}
        </select>
      </div>

      {/* Main content area - Adjusted ratio */}
      <div className="flex flex-1 overflow-hidden">
        {/* Course Map - Takes 80% of the width */}
        <div className="w-[80%] overflow-hidden p-4">
          {programStructure && (
            <svg
              ref={svgRef}
              width={svgDimensions.width}
              height={svgDimensions.height}
              className="mx-auto cursor-grab"
              onMouseDown={handleMouseDown}
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
            >
              {/* Add marker definition for arrowhead */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="100"
                  markerHeight="100"
                  refX="30"
                  refY="5"
                  orient="auto-start-reverse"
                >
                  <polygon points="0 0, 10 5, 0 10" fill="#000" />
                </marker>
              </defs>

              <g transform={`translate(${offset.x}, ${offset.y})`}>
                {/* Render prerequisite lines with arrows */}
                {renderPrerequisiteLines.map((line) => (
                  <line
                    key={line.id}
                    x1={line.source.x}
                    y1={line.source.y}
                    x2={line.target.x}
                    y2={line.target.y}
                    stroke="#000"
                    strokeWidth={1.5}
                    markerEnd="url(#arrowhead)" // Add arrowhead at the end
                    opacity={
                      selectedNode
                        ? line.id.includes(selectedNode)
                          ? 2
                          : 0.1
                        : 0.01
                    }
                  />
                ))}

                {/* Draw edges */}
                {programStructure.courses.map((course) => {
                  const prereqs = course.prerequisites || [];
                  return prereqs.map((prereq) => {
                    const sourcePos = nodePositions[prereq];
                    const targetPos = nodePositions[course.course_number];
                    if (!sourcePos || !targetPos) return null;

                    return (
                      <line
                        key={`${prereq}-${course.course_number}`}
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke="#999"
                        strokeWidth={1}
                        opacity={
                          selectedNode
                            ? selectedNode === course.course_number ||
                              selectedNode === prereq
                              ? 1
                              : 0.2
                            : 0.5
                        }
                      />
                    );
                  });
                })}

                {/* Draw nodes */}
                {programStructure.courses.map((course) => {
                  const position = nodePositions[course.course_number];
                  if (!position) return null;

                  // Split course number into department and number
                  const [dept, num] = course.course_number.split(" ");

                  return (
                    <g
                      key={course.course_number}
                      transform={`translate(${position.x},${position.y})`}
                      onMouseEnter={() => setSelectedNode(course.course_number)}
                      onMouseLeave={() => setSelectedNode(null)}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent drag when clicking node
                        window.open(course.link, "_blank");
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        r={30} // Increased radius to fit more text
                        fill={`hsl(${parseInt(num) * 1.5}, 70%, 80%)`}
                        stroke={
                          selectedNode === course.course_number
                            ? "#000"
                            : "none"
                        }
                        strokeWidth={2}
                      />
                      {/* Department text */}
                      <text
                        textAnchor="middle"
                        dy="-0.5em" // Move up from center
                        fontSize={10} // Smaller font for department
                        fill="#000"
                      >
                        {dept}
                      </text>
                      {/* Course number text */}
                      <text
                        textAnchor="middle"
                        dy="1em" // Move down from center
                        fontSize={12} // Slightly larger font for number
                        fill="#000"
                      >
                        {num}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Course Info Panel */}
        <div className="w-[20%] border-l p-4 bg-gray-50">
          {selectedNode &&
          programStructure?.courses.find(
            (c) => c.course_number === selectedNode
          ) ? (
            <>
              <h2 className="text-xl font-bold mb-2">{selectedNode}</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="font-semibold">Course Title</h3>
                  <p className="text-gray-700">
                    {
                      programStructure.courses.find(
                        (c) => c.course_number === selectedNode
                      ).course_title
                    }
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Prerequisites</h3>
                  <div className="text-gray-700">
                    {(() => {
                      const course = programStructure.courses.find(
                        (c) => c.course_number === selectedNode
                      );
                      const prereqs = course?.prerequisites || [];

                      if (prereqs.length === 0) return "None";

                      return (
                        <ul className="list-disc pl-4 space-y-1">
                          {prereqs.map((prereq) => {
                            // Get details from programStructure instead of department file
                            const prereqDetails = programStructure.courses.find(
                              (c) => c.course_number === prereq
                            );
                            return (
                              <li
                                key={prereq}
                                className={`hover:text-blue-600 cursor-pointer ${
                                  nodePositions[prereq] ? "" : "opacity-50"
                                }`}
                                onClick={() => {
                                  const node = nodePositions[prereq];
                                  if (node) {
                                    setSelectedNode(prereq);
                                  }
                                }}
                              >
                                <span className="font-medium">{prereq}</span>
                                {prereqDetails && (
                                  <span className="text-gray-500 text-xs block ml-2">
                                    {prereqDetails.course_title}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold">Credits</h3>
                  <p className="text-gray-700">
                    {
                      programStructure.courses.find(
                        (c) => c.course_number === selectedNode
                      ).credits
                    }
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-500 italic text-sm">
              Hover over a course to see its details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
