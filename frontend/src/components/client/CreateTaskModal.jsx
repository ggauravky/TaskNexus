import { useEffect, useMemo, useState } from 'react';
import { X, DollarSign, Calendar, FileText, Tag, Clock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const defaultFormData = {
  title: '',
  description: '',
  category: '',
  budget: '',
  deadline: '',
  skillsRequired: '',
  experienceLevel: 'intermediate',
};

const normalizeInitialData = (incoming) => {
  if (!incoming) {
    return { ...defaultFormData };
  }

  const normalizedSkills = Array.isArray(incoming.skillsRequired)
    ? incoming.skillsRequired.join(', ')
    : incoming.skillsRequired || '';

  return {
    ...defaultFormData,
    ...incoming,
    skillsRequired: normalizedSkills,
    budget: incoming.budget ?? '',
  };
};

/**
 * Create Task Modal Component
 * Allows clients to create new tasks
 */
const CreateTaskModal = ({ isOpen, onClose, onTaskCreated, initialData = null }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...defaultFormData });

  const categories = useMemo(
    () => [
      { value: 'web_development', label: 'Web Development' },
      { value: 'mobile_development', label: 'Mobile Development' },
      { value: 'design', label: 'Design' },
      { value: 'writing', label: 'Writing' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'data_entry', label: 'Data Entry' },
      { value: 'video_editing', label: 'Video Editing' },
      { value: 'other', label: 'Other' },
    ],
    [],
  );

  const experienceLevels = useMemo(
    () => [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'expert', label: 'Expert' },
    ],
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormData(normalizeInitialData(initialData));
  }, [isOpen, initialData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim() || formData.title.trim().length < 5) {
      toast.error('Title must be at least 5 characters long');
      return;
    }

    const cleanDescription = formData.description.trim();
    if (!cleanDescription) {
      toast.error('Description is required');
      return;
    }
    if (cleanDescription.length < 20) {
      toast.error('Description must be at least 20 characters long');
      return;
    }
    if (cleanDescription.length > 5000) {
      toast.error('Description must not exceed 5000 characters');
      return;
    }
    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }
    if (!formData.budget || Number(formData.budget) < 10) {
      toast.error('Budget must be at least $10');
      return;
    }
    if (!formData.deadline) {
      toast.error('Please select a deadline');
      return;
    }

    try {
      setLoading(true);

      const taskData = {
        title: formData.title.trim(),
        description: cleanDescription.replace(/\s+/g, ' '),
        category: formData.category,
        budget: Number(formData.budget),
        deadline: formData.deadline,
        skillsRequired: formData.skillsRequired
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        experienceLevel: formData.experienceLevel,
      };

      const response = await api.post('/tasks', taskData);

      if (response.data.success) {
        toast.success('Task created successfully!');
        onTaskCreated();
        handleClose();
      }
    } catch (error) {
      let errorMsg = 'Failed to create task';

      if (error.response?.data) {
        const responseData = error.response.data;

        if (responseData.error?.details && Array.isArray(responseData.error.details)) {
          errorMsg =
            responseData.error.details
              .map((issue) => `${issue.field}: ${issue.message}`)
              .join('\n') || responseData.error.message || 'Validation failed';
        } else if (responseData.error?.message) {
          errorMsg = responseData.error.message;
        } else if (typeof responseData.error === 'string') {
          errorMsg = responseData.error;
        } else if (responseData.message) {
          errorMsg = responseData.message;
        }
      } else if (error.request) {
        errorMsg = 'No response from server. Please check your connection.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ ...defaultFormData });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 rounded-2xl border border-white/70 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Create New Task</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Build a responsive website"
                className="input pl-10"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 5 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your task in detail..."
              rows="5"
              className="input"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 20 characters. Be specific about requirements and expectations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="input pl-10"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  className="input pl-10"
                  required
                >
                  {experienceLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget (USD) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  placeholder="100"
                  min="10"
                  max="100000"
                  step="0.01"
                  className="input pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum $10</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deadline *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  min={minDate}
                  className="input pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Skills Required (Optional)</label>
            <input
              type="text"
              name="skillsRequired"
              value={formData.skillsRequired}
              onChange={handleChange}
              placeholder="e.g., React, Node.js, MongoDB"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple skills with commas</p>
          </div>

          <div className="flex space-x-4 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
