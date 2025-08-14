'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
  disabled?: boolean
}

export function TimePicker({ value, onChange, label, className, disabled }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null)
  const [isAM, setIsAM] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Hours from 6am to 8pm
  const hours = Array.from({ length: 15 }, (_, i) => i + 6) // 6, 7, 8, ..., 20
  const minutes = [0, 15, 30, 45]

  // Parse current value
  useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':').map(Number)
      if (hours !== undefined && minutes !== undefined) {
        setSelectedHour(hours)
        setSelectedMinute(minutes)
        setIsAM(hours < 12)
      }
    }
  }, [value])

  // Handle hour selection
  const handleHourSelect = (hour: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    setSelectedHour(hour)
    setIsAM(hour < 12)
    updateTime(hour, selectedMinute || 0)
  }

  // Handle minute selection
  const handleMinuteSelect = (minute: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    setSelectedMinute(minute)
    if (selectedHour !== null) {
      updateTime(selectedHour, minute)
    }
  }

  // Update the time value
  const updateTime = (hour: number, minute: number) => {
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    onChange(timeString)
  }

  // Handle manual input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Parse the input to update our internal state
    if (newValue) {
      const [hours, minutes] = newValue.split(':').map(Number)
      if (hours !== undefined && minutes !== undefined) {
        setSelectedHour(hours)
        setSelectedMinute(minutes)
        setIsAM(hours < 12)
      }
    }
  }

  // Handle AM/PM toggle
  const handleAMPMToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (selectedHour !== null) {
      let newHour = selectedHour
      if (isAM && selectedHour < 12) {
        // Convert AM to PM
        newHour = selectedHour + 12
      } else if (!isAM && selectedHour >= 12) {
        // Convert PM to AM
        newHour = selectedHour - 12
      }
      setSelectedHour(newHour)
      setIsAM(!isAM)
      updateTime(newHour, selectedMinute || 0)
    }
  }

  // Format display value
  const formatDisplayValue = (timeString: string) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':').map(Number)
    if (hours === undefined || minutes === undefined) return timeString
    
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <Clock className="mr-2 h-4 w-4" />
            {value ? formatDisplayValue(value) : "Select time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 bg-white border-2 border-gray-200 shadow-xl" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div 
            className="p-4" 
            onClick={(e) => e.stopPropagation()} 
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <Label className="text-sm font-medium">Select Time</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Hours Column */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Hour</Label>
                <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                  {hours.map((hour) => {
                    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
                    const isSelected = selectedHour === hour
                    const isCurrentHour = value && selectedHour === hour
                    
                    return (
                      <Button
                        key={hour}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 text-xs",
                          isSelected && "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                        onClick={(e) => handleHourSelect(hour, e)}
                      >
                        {displayHour}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Minutes Column */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Minute</Label>
                <div className="grid grid-cols-2 gap-1">
                  {minutes.map((minute) => {
                    const isSelected = selectedMinute === minute
                    
                    return (
                      <Button
                        key={minute}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 text-xs",
                          isSelected && "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                        onClick={(e) => handleMinuteSelect(minute, e)}
                      >
                        {minute.toString().padStart(2, '0')}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* AM/PM Toggle */}
            <div className="flex items-center justify-center mt-4">
              <Button
                variant={isAM ? "default" : "outline"}
                size="sm"
                onClick={(e) => handleAMPMToggle(e)}
                className={cn(
                  "rounded-r-none",
                  isAM && "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                AM
              </Button>
              <Button
                variant={!isAM ? "default" : "outline"}
                size="sm"
                onClick={(e) => handleAMPMToggle(e)}
                className={cn(
                  "rounded-l-none",
                  !isAM && "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                PM
              </Button>
            </div>

                                    {/* Manual Input */}
                        <div className="mt-4">
                          <Label className="text-sm font-medium mb-2 block">Or type manually</Label>
                          <Input
                            ref={inputRef}
                            type="time"
                            value={value}
                            onChange={handleInputChange}
                            className="w-full"
                            placeholder="HH:MM"
                          />
                        </div>

                        {/* Save Button */}
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <Button
                            onClick={() => setIsOpen(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Save Time
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
      </Popover>
    </div>
  )
}
